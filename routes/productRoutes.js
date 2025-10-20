 import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Product from "../models/Product.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Get all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().populate("seller", "name email");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
});


router.get("/detail/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("seller", "name email phone");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Error fetching product", error });
  }
});

// ✅ Admin delete any product
router.delete("/admin/:id", verifyToken, async (req, res) => {
  try {
    // Optional: Add an admin check
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    await product.deleteOne();
    res.json({ message: "Product deleted successfully by admin." });
  } catch (err) {
    res.status(500).json({ message: "Error deleting product", error: err });
  }
});

const uploadDir  = "uploads/";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// ✅ Create product with image

router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const newProduct = new Product({
      ...req.body,
      seller: req.user.id,
      images: req.file ? [`/${req.file.path}`] : [],
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: "Error creating product", error });
  }
});
router.get("/my",verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const products = await Product.find({ seller: req.user.id });

    res.json(products);
  } catch (err) {
    console.error("Error fetching your products:", err);
    res.status(500).json({ message: "Error fetching your products" });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Ensure only the owner can delete
    if (product.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
});

// ✅ Update Product Route
router.put("/:id", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.seller.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const updateData = {
      name: req.body.name,
      model: req.body.model,
      price: req.body.price,
      category: req.body.category,
      condition: req.body.condition,
      location: req.body.location,
      description: req.body.description,
    };

    // If new image is uploaded
    if (req.file) {
      updateData.images = [`/${uploadDir}${req.file.filename}`];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating product" });
  }
});


export default router;
