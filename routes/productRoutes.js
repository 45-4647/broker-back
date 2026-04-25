import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import Product from "../models/Product.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import dotenv from "dotenv";  
import { OpenAI } from "openai";
dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router = express.Router();


/* ---------------- CLOUDINARY STORAGE ---------------- */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "broker-products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

/* ---------------- GET ALL PRODUCTS ---------------- */




// GET all products — respond immediately, AI runs with a tight timeout
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("seller", "name email")
      .lean();

    // Simple fast fallback: newest 5 paid products
    const fallback = [...products]
      .filter(p => p.paymentStatus === "paid")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Try AI with a 3s hard timeout — if it takes longer, use fallback
    let recommendedProducts = fallback;

    try {
      const aiPromise = openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "user",
          content: `From the list below, select the 5 most relevant products. Return only a JSON array of product IDs.\n\nProducts:\n${JSON.stringify(products.map(p => ({ _id: p._id, title: p.name, description: p.description, category: p.category })))}`
        }],
        max_tokens: 200
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), 3000)
      );

      const response = await Promise.race([aiPromise, timeoutPromise]);
      const ids = JSON.parse(response.choices[0].message.content.trim());
      const aiPicks = products.filter(p => ids.includes(p._id.toString()));
      if (aiPicks.length > 0) recommendedProducts = aiPicks;

    } catch {
      // AI unavailable or timed out — fallback already set
    }

    res.json({ allProducts: products, recommended: recommendedProducts });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});




/* ---------------- GET SELLER'S OTHER PRODUCTS ---------------- */
router.get("/seller/:sellerId", async (req, res) => {
  try {
    const products = await Product.find({
      seller: req.params.sellerId,
      _id: { $ne: req.query.exclude },
      paymentStatus: "paid",
    })
      .populate("seller", "name")
      .limit(6)
      .lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching seller products" });
  }
});

/* ---------------- GET RELATED PRODUCTS ---------------- */
router.get("/related/:category", async (req, res) => {
  try {
    const products = await Product.find({
      category: req.params.category,
      _id: { $ne: req.query.exclude },
      paymentStatus: "paid",
    })
      .limit(6)
      .lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching related products" });
  }
});

/* ---------------- GET SINGLE PRODUCT ---------------- */
router.get("/detail/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "seller",
      "name email phone"
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error });
  }
});

/* ---------------- CREATE PRODUCT ---------------- */
router.post("/", verifyToken, (req, res) => {
  return res.status(403).json({
    message: "You must pay before posting a product",
  });
});

/* ---------------- GET MY PRODUCTS ---------------- */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.id });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching your products" });
  }
});

/* ---------------- ADMIN DELETE ---------------- */
router.delete("/admin/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only" });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.imagePublicIds?.length) {
      for (const id of product.imagePublicIds) {
        await cloudinary.uploader.destroy(id);
      }
    }

    await product.deleteOne();
    res.json({ message: "Product deleted by admin" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting product", error: err });
  }
});

/* ---------------- DELETE PRODUCT (SELLER) ---------------- */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.seller.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    // Delete image from Cloudinary
    if (product.imagePublicIds?.length) {
      for (const id of product.imagePublicIds) {
        await cloudinary.uploader.destroy(id);
      }
    }

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
});

/* ---------------- UPDATE PRODUCT ---------------- */
router.put("/:id", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (product.seller.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const updateData = { ...req.body };

    if (req.file) {
      // Delete old image
      if (product.imagePublicIds?.length) {
        for (const id of product.imagePublicIds) {
          await cloudinary.uploader.destroy(id);
        }
      }

      updateData.images = [req.file.path];
      updateData.imagePublicIds = [req.file.filename];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: "Error updating product" });
  }
});

export default router;
