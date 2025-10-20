import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
  {
    members: {
      type: [String],
      required: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    unreadCount: {
      type: Map, // stores unread count per user
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("ChatRoom", chatRoomSchema);
