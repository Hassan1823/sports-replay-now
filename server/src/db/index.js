import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      // `${process.env.MONGODB_URI}/${DB_NAME}`
      `${process.env.MONGODB_URI}`
    );
    console.log(`\n✅  DB connected: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log(`⚠️  Database ERROR:`, error);
    process.exit(1);
  }
};

export default connectDB;
