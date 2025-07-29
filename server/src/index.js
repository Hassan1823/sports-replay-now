// require("dotenv").config();

import dotenv from "dotenv";

import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config();

// connect to the database
connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.log(`☄️  Server Crashed: ${error}`);
    });

    app.listen(process.env.PORT || 8000, () => {
      console.log(`🚀  Server Running At PORT: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log(`❌  DB Connection Failed: ${error}`);
  });
