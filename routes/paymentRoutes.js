import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import Product from "../models/Product.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import axios from "axios";
import Stripe from "stripe";



const router = express.Router();

/* ---------------- CLOUDINARY STORAGE ---------------- */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "broker-products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const upload = multer({ storage });

/* ---------------- BLOCK DIRECT PRODUCT POST ---------------- */
router.post("/", verifyToken, (req, res) => {
  return res.status(403).json({
    message: "You must pay before posting a product",
  });
});

/* ---------------- CHAPA PAYMENT ---------------- */
router.post(
  "/chapa",
  verifyToken,

  // ✅ SAFE MULTER WRAPPER (VERY IMPORTANT)
  (req, res, next) => {
    upload.single("image")(req, res, function (err) {
      if (err) {
        console.error("❌ MULTER ERROR:", err);
        return res.status(500).json({ message: "Image upload failed" });
      }
      next();
    });
  },

  async (req, res) => {
    try {
      console.log("✅ ROUTE HIT");
      console.log("USER:", req.user);
      console.log("BODY:", req.body);
      console.log("FILE:", req.file);

      const tx_ref = "tx-" + Date.now();

      // ✅ SAFE PRODUCT DATA BUILD
      const productData = {
        name: req.body.name,
        model: req.body.model,
        price: req.body.price,
        category: req.body.category,
        condition: req.body.condition,
        location: req.body.location,
        description: req.body.description,

        seller: req.user.id,

        images: req.file ? [req.file.path] : [],
        imagePublicIds: req.file ? [req.file.filename] : [],
      };

      // ✅ CHAPA REQUEST
      const response = await axios.post(
        "https://api.chapa.co/v1/transaction/initialize",
        {
          amount: "200",
          currency: "ETB",

          // 🔥 use logged-in user (fallback safe)
          email: req.user?.email || "test@email.com",
          first_name: req.user?.name || "User",
          last_name: "User",

          tx_ref,

          callback_url: `http://localhost:5000/api/payment/chapa/verify?tx_ref=${tx_ref}`,
          return_url: `http://localhost:3001/payment-success?tx_ref=${tx_ref}`,

          meta: {
            productData: JSON.stringify(productData),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
          },
        }
      );

      console.log("✅ CHAPA RESPONSE:", response.data);

      return res.json({
        url: response.data.data.checkout_url,
      });

    } catch (error) {
      console.error(
        "🔥 PAYMENT ERROR:",
        error.response?.data || error.message
      );

      return res.status(500).json({
        message: "Chapa payment failed",
      });
    }
  }
);

/* ---------------- VERIFY CHAPA ---------------- */
router.get("/chapa/verify", async (req, res) => {
  try {
    const { tx_ref } = req.query;

    console.log("🔄 VERIFYING PAYMENT:", tx_ref);

    // ✅ Idempotency check — prevent duplicate product on double-call
    const existing = await Product.findOne({ tx_ref });
    if (existing) {
      console.log("⚠️ Product already saved for tx_ref:", tx_ref);
      return res.json({ success: true });
    }

    const verify = await axios.get(
      `https://api.chapa.co/v1/transaction/verify/${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        },
      }
    );

    console.log("✅ VERIFY RESPONSE:", verify.data);

    if (verify.data.status === "success") {
      const productData = JSON.parse(verify.data.data.meta.productData);

      const newProduct = new Product({
        ...productData,
        paymentStatus: "paid",
        tx_ref, // store for idempotency
      });

      await newProduct.save();
      console.log("✅ PRODUCT SAVED");
      return res.json({ success: true });
    }

    return res.send("❌ Payment not verified");

  } catch (error) {
    console.error("🔥 VERIFY ERROR:", error.response?.data || error.message);
    return res.send("Verification failed");
  }
});

router.post(
  "/stripe",
  verifyToken,

  // ✅ same safe multer wrapper
  (req, res, next) => {
    upload.single("image")(req, res, function (err) {
      if (err) {
        console.error("❌ MULTER ERROR:", err);
        return res.status(500).json({ message: "Image upload failed" });
      }
      next();
    });
  },

  async (req, res) => {
    try {
      console.log("💳 STRIPE ROUTE HIT");

      const productData = {
        name: req.body.name,
        model: req.body.model,
        price: req.body.price,
        category: req.body.category,
        condition: req.body.condition,
        location: req.body.location,
        description: req.body.description,

        seller: req.user.id,

        images: req.file ? [req.file.path] : [],
        imagePublicIds: req.file ? [req.file.filename] : [],
      };

      // ✅ Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",

        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Product Promotion Fee",
              },
              unit_amount: 500 * 100, // $5 (adjust if needed)
            },
            quantity: 1,
          },
        ],

        success_url: `http://localhost:3001/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:3001/post-product`,

        metadata: {
          productData: JSON.stringify(productData),
        },
      });

      return res.json({
        url: session.url,
      });

    } catch (error) {
      console.error("🔥 STRIPE ERROR:", error.message);
      return res.status(500).json({
        message: "Stripe payment failed",
      });
    }
  }
);

router.get("/stripe/verify", async (req, res) => {
  try {
    const { session_id } = req.query;

    console.log("🔄 VERIFY STRIPE:", session_id);

    // ✅ Idempotency check — prevent duplicate product on double-call
    const existing = await Product.findOne({ tx_ref: session_id });
    if (existing) {
      console.log("⚠️ Product already saved for session:", session_id);
      return res.json({ success: true });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      const productData = JSON.parse(session.metadata.productData);

      const newProduct = new Product({
        ...productData,
        paymentStatus: "paid",
        tx_ref: session_id, // store for idempotency
      });

      await newProduct.save();
      console.log("✅ PRODUCT SAVED (STRIPE)");
      return res.json({ success: true });
    }

    return res.send("❌ Payment not completed");

  } catch (error) {
    console.error("🔥 STRIPE VERIFY ERROR:", error.message);
    return res.send("Verification failed");
  }
});
export default router;