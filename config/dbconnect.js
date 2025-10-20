
import mongoose from "mongoose"


// MongoDB Connection Function with Topology Options
 export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    

    console.log('Connected to MongoDB!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Handle the error appropriately, e.g., exit the process or retry
    process.exit(1); // Exit the process if the database connection fails
  }
}
