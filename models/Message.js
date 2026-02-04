import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom", // reference to the chat room collection
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // userId of sender (you can later ref to User if you have that model)
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    readBy: {
      type: [String], // list of userIds who have read this message
      default: [],
    },
  },
  { timestamps: true }
);

// optional index for faster queries by room
messageSchema.index({ roomId: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
