import express from "express";
import bcrypt from "bcryptjs";
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

router.put("/me", verifyToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone },
      { new: true }
    ).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.put("/me/password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error updating password" });
  }
});


export default router;
