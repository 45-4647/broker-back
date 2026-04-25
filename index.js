
// import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import paymentRoutes from "./routes/paymentRoutes.js";
import jwt from "jsonwebtoken";

import { connectDB } from "./config/dbconnect.js"; // Assumes you have a database connection setup in dbconnect.js
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import Message from "./models/Message.js"; // Make sure these paths are correct
import ChatRoom from "./models/ChatRoom.js"; // Make sure these paths are correct
import User from "./models/User.js";
import Product from "./models/Product.js";
// import { createApp } from "./app.js";
import express from "express"

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to the Database
connectDB()
  .then(() => console.log("🟢 Connected to MongoDB"))
  .catch((err) => console.error("🔴 MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Serve static files
// app.use("/uploads", express.static("uploads"));

// ------------------ CHAT ROUTES ------------------

// Create or get a chat room — strictly scoped per product, atomic upsert
app.post("/api/chatroom", async (req, res) => {
  const { user1, user2, productId } = req.body;

  if (!user1 || !user2 || !productId) {
    return res.status(400).json({ message: "user1, user2 and productId are required" });
  }

  try {
    const members = [String(user1), String(user2)].sort();

    // Try to find existing room first
    let room = await ChatRoom.findOne({ members, productId });

    // Create if not found
    if (!room) {
      room = await ChatRoom.create({ members, productId, unreadCount: {}, lastMessage: "" });
      console.log(`✔️ New room: ${room._id} for product: ${productId}`);
    }

    res.json(room);
  } catch (error) {
    console.error("❌ Error creating chat room:", error.message);
    res.status(500).json({ message: error.message });
  }
});


// admin feature — all routes protected, admin only
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ message: "No token" });
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(403).json({ message: "Admins only" });
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Products
app.get("/api/admin/products", adminAuth, async (req, res) => {
  const products = await Product.find().populate("seller", "name email role");
  res.json(products);
});

app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.put("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("seller", "name email");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// Users
app.get("/api/admin/users", adminAuth, async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

app.delete("/api/admin/users/:id", adminAuth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.put("/api/admin/users/:id/role", adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["buyer", "seller", "admin"].includes(role))
      return res.status(400).json({ message: "Invalid role" });
    const updated = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Role update failed" });
  }
});

// One-time cleanup: delete old rooms that have no productId (legacy data)
app.delete("/api/admin/chatrooms/cleanup", adminAuth, async (req, res) => {
  const result = await ChatRoom.deleteMany({ productId: null });
  res.json({ deleted: result.deletedCount });
});

// ChatRooms
app.get("/api/admin/chatrooms", adminAuth, async (req, res) => {
  const rooms = await ChatRoom.find();
  res.json(rooms);
});

app.delete("/api/admin/chatrooms/:id", adminAuth, async (req, res) => {
  await Message.deleteMany({ roomId: req.params.id });
  await ChatRoom.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});



// Get a single chat room by ID (with product + member info)
app.get("/api/chatroom/:roomId", async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId)
      .populate("members", "name email")
      .populate("productId", "name images");
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: "Error fetching room" });
  }
});

// Get all chat rooms for a user
app.get("/api/chatrooms/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    const rooms = await ChatRoom.find({ members: { $in: [userId] } })
      .sort({ updatedAt: -1 })
      .populate("members", "name email")
      .populate("productId", "name images");

    console.log(`✔️ Fetched ${rooms.length} chatrooms for user: ${userId}`);
    res.json(rooms);
  } catch (error) {
    console.error("❌ Error fetching chat rooms:", error);
    res.status(500).json({ message: "Error fetching chat rooms" });
  }
});

// Fetch all messages in a chat room
app.get("/api/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    // Validate roomId
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: "Invalid roomId format" });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Chatroom not found" });
    }

    const messages = await Message.find({ roomId: room._id }).populate("sender", "name email").sort({ createdAt: 1 });

    console.log(`✔️ Fetched ${messages.length} messages for room: ${roomId}`);
    res.json(messages);
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// delete the message

// DELETE route to delete a chat room
app.delete("/api/chatrooms/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    // Validate that the user has access to delete the room, you may choose to authorize here

    // Delete the chat room
    const room = await ChatRoom.findByIdAndDelete(roomId);

    if (!room) {
      return res.status(404).send({ message: "Chat room not found" });
    }

    await Message.deleteMany({ roomId: roomId });

    res.status(200).send({ message: "Chat room deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat room:", error);
    res.status(500).send({ message: "Error deleting chat room" });
  }
});

// import ChatRoom from "../models/ChatRoom.js";

app.post("/api/chatrooms/findOrCreate", async (req, res) => {
  const { members, productId } = req.body;
  if (!members || members.length !== 2) return res.status(400).json({ message: "Members required" });
  if (!productId) return res.status(400).json({ message: "productId required" });

  try {
    let room = await ChatRoom.findOne({ members: { $all: members, $size: 2 }, productId });
    if (!room) {
      room = await ChatRoom.create({ members, productId });
    }
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// Mark messages as read
app.post("/api/chatrooms/:roomId/read", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    // Validate roomId and userId
    if (
      !mongoose.Types.ObjectId.isValid(roomId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({ message: "Invalid roomId or userId format" });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

        // Make sure userId is string
        const uid = userId.toString();
        //Update unread count
        let unreadField = `unreadCount.${uid}`;
        await ChatRoom.findByIdAndUpdate(
              roomId,
              { $set: { [unreadField]: 0 } }  // Increment unread count for this member
            );

    console.log(`✔️ Marked messages as read for user ${userId} in room ${roomId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error marking as read:", error);
    res.status(500).json({ message: "Error updating read status" });
  }
});


const io = new Server(server, {
  cors: {
    origin: "*", // In production, set your frontend URLs
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`🟢 New client connected: ${socket.id}`);

  // Join a chat room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`✔️ Socket ${socket.id} joined room ${roomId}`);
  });

  // Send a message
  socket.on("sendMessage", async ({ roomId, message, sender }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(sender)) {
        console.error("Invalid roomId or sender format");
        return;
      }

      const room = await ChatRoom.findById(roomId);
      if (!room) return console.error("ChatRoom not found for id:", roomId);

      // Save the new message
      const newMessage = new Message({ roomId: room._id, sender, message });
      await newMessage.save();

      // Update lastMessage & updatedAt safely
      await ChatRoom.findByIdAndUpdate(roomId, {
        lastMessage: message,
        updatedAt: Date.now(),
      });

      // Increment unread count for all other members
      await Promise.all(
        room.members
          .filter((memberId) => memberId.toString() !== sender.toString())
          .map((memberId) => {
            const unreadField = `unreadCount.${memberId}`;
            return ChatRoom.findByIdAndUpdate(roomId, { $inc: { [unreadField]: 1 } });
          })
      );

      // Emit message to all clients in the room
      io.to(roomId).emit("receiveMessage", {
        message,
        sender,
        createdAt: newMessage.createdAt,
      });

    } catch (error) {
      console.error("❌ Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

app.get("/",(req,res)=>{
  res.send("the app port 40000")

})



app.use("/api/payment", paymentRoutes);

// if (process.env.NODE_ENV !== "test") {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// }
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
