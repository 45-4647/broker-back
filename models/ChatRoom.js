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

// compound unique index: one room per (sorted members + product)
chatRoomSchema.index({ members: 1, productId: 1 }, { unique: true });

export default mongoose.model("ChatRoom", chatRoomSchema);
