import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    model: { type: String },
    price: { type: Number, required: true },
    category: { type: String },
    condition: { type: String, enum: ["New", "Used"], required: true },
    location: { type: String, required: true },
    description: { type: String },
    images: [{ type: String }],
    imagePublicIds: [String], // Cloudinary URLs   
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
