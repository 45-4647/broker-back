import express from "express";
import { register, login } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user info" });
  }
});


export default router;
