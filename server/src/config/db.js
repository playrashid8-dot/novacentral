import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI missing — exiting");
      process.exit(1);
    }

    mongoose.set("strictQuery", true); // 🔒 safer queries

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000, // ⏱ timeout
    });

    console.log(`MongoDB Connected ✅: ${conn.connection.host}`);
    return conn;

  } catch (error) {
    console.error("MongoDB required — shutting down");
    process.exit(1);
  }
};

export default connectDB;