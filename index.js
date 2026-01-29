
// import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

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
app.use("/uploads", express.static("uploads"));

// ------------------ CHAT ROUTES ------------------

// Create or get a chat room between two users
app.post("/api/chatroom", async (req, res) => {
  const { user1, user2 } = req.body;

  try {
    // Check if the chatroom already exists
    let room = await ChatRoom.findOne({ members: { $all: [user1, user2] } });

    if (!room) {
      // Create new chatroom
      room = new ChatRoom({ members: [user1, user2] });

      //Initial unread settings for new members
        room.members.forEach(memberId => {
          room.unreadCount[memberId] = 0;
         });
         await room.save();
      console.log(`✔️ New chatroom created with ID: ${room._id}`);
    }

    res.json(room);
  } catch (error) {
    console.error("❌ Error creating chat room:", error);
    res.status(500).json({ message: "Server error creating chat room" });
  }
});


// admin feature
// Products
app.get("/api/admin/products", async (req, res) => {
  const products = await Product.find().populate("seller", "name email");
  res.json(products);
});

// Users
app.get("/api/admin/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// ChatRooms
app.get("/api/admin/chatrooms", async (req, res) => {
  const rooms = await ChatRoom.find();
  res.json(rooms);
});

// Delete product
app.delete("/api/admin/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Ban/Delete user
app.delete("/api/admin/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Clear chat messages
app.delete("/api/admin/chatrooms/:id", async (req, res) => {
  await Message.deleteMany({ roomId: req.params.id });
  await ChatRoom.findByIdAndDelete(req.params.id);
  res.json({ success: true });
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
      .sort({ updatedAt: -1 }) // Sort by most recent update
      .populate("members", "name email"); // Populate user info

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

    const messages = await Message.find({ chatroom: room._id }) // Use chatroom, not roomId
      .sort({ createdAt: 1 }); // Sort by oldest first

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

    // Optionally delete associated messages
    await Message.deleteMany({ chatroom: roomId });

    res.status(200).send({ message: "Chat room deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat room:", error);
    res.status(500).send({ message: "Error deleting chat room" });
  }
});

// import ChatRoom from "../models/ChatRoom.js";

app.post("/api/chatrooms/findOrCreate", async (req, res) => {
  const { members } = req.body; // [buyerId, sellerId]
  if (!members || members.length !== 2) return res.status(400).json({ message: "Members required" });

  try {
    // Find existing room
    let room = await ChatRoom.findOne({ members: { $all: members, $size: 2 } });
    console.log(room)
    if (!room) {
      // Create new room
      room = await ChatRoom.create({ members });
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



// if (process.env.NODE_ENV !== "test") {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// }
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
