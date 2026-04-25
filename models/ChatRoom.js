import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
  {
    members: {
      type: [String],
      required: true,
      ref:"User"
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// No unique index — deduplication handled in application code
export default mongoose.model("ChatRoom", chatRoomSchema);
