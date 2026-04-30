import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("❌ MONGO_URI not defined in .env");
    }

    mongoose.set("strictQuery", true); // 🔒 safer queries

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000, // ⏱ timeout
    });

    console.log(`MongoDB Connected ✅: ${conn.connection.host}`);
    return conn;

  } catch (error) {
    console.error("❌ MongoDB Error:", error.message);
    return null;
  }
};

export default connectDB;