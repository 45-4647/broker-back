import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import Product from "../models/Product.js";
import { verifyToken } from "../middleware/authMiddleware.js";

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
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().populate("seller", "name email");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
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
