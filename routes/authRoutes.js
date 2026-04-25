import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import { register, login } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "broker-avatars", allowed_formats: ["jpg", "png", "jpeg", "webp"], transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }] },
});
const uploadAvatar = multer({ storage: avatarStorage });

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

router.put("/me/avatar", verifyToken, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });
    // delete old avatar from cloudinary if exists
    const user = await User.findById(req.user.id);
    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId).catch(() => {});
    }
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: req.file.path, profileImagePublicId: req.file.filename },
      { new: true }
    ).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error uploading avatar" });
  }
});

router.delete("/me/avatar", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId).catch(() => {});
    }
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: null, profileImagePublicId: null },
      { new: true }
    ).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error removing avatar" });
  }
});
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
