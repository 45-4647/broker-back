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




// GET all products with AI recommendations
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("seller", "name email")
      .lean();

    let recommendedProducts = [];

    try {
      // === AI RECOMMENDATION TRY ===
      const prompt = `
        From the list below, select the 5 most relevant products.
        Return only a JSON array of product IDs.

        Products:
        ${JSON.stringify(
          products.map(p => ({
            _id: p._id,
            title: p.title || p.name,
            description: p.description,
            category: p.category
          }))
        )}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200
      });

      const ids = JSON.parse(
        response.choices[0].message.content.trim()
      );

      recommendedProducts = products.filter(p =>
        ids.includes(p._id.toString())
      );

    } catch (aiError) {
      console.warn("⚠️ AI unavailable, using fallback logic");

      // === FALLBACK LOGIC ===
      recommendedProducts = products
        .filter(p => p.views > 10 || p.createdAt)
        .slice(0, 5);
    }

    res.json({
      allProducts: products,
      recommended: recommendedProducts
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch products"
    });
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
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const newProduct = new Product({
      ...req.body,
      seller: req.user.id,
      images: req.file ? [req.file.path] : [], // Cloudinary URL
      imagePublicIds: req.file ? [req.file.filename] : [], // Needed for delete
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: "Error creating product", error });
  }
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
