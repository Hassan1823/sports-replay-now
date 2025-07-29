import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { initializePeerTubeAuth } from "./utils/peertubeAuth.js"; // Import the initialization function

const app = express();

// Initialize PeerTube auth before setting up other middleware
try {
  await initializePeerTubeAuth();
} catch (error) {
  console.error(
    "Failed to initialize PeerTube authentication. Some features may not work:",
    error
  );
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// * importing routes
import paymentRoutes from "./routes/payment.routes.js";
import peertubeRoutes from "./routes/peertube.routes.js";
import seasonRoutes from "./routes/season.routes.js";
import userRoutes from "./routes/user.routes.js";

// * routes declaration
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/peertube", peertubeRoutes);
app.use("/api/v1/seasons", seasonRoutes);

//* declaration of the root route
app.get("/", (req, res) => {
  res.status(200).send("🚀 Welcome to Vision Sports Sever");
});

// * declaration of the 404 route
app.use((req, res) => {
  res.status(404).send("❌ Route not found");
});

export { app };
