import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: Number,
      required: false,
      trim: true,
    },
    // Stripe/Payment Fields
    stripeCustomerId: {
      type: String,
      required: false,
      default: "",
    }, // Stores Stripe's customer ID
    stripeSubscriptionId: {
      type: String,
      required: false,
      default: "",
    }, // Active subscription ID
    stripePaymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "canceled"],
      default: "pending",
      required: false,
    },
    subscriptionExpiry: {
      type: Date,
      required: false,
      default: null,
    }, // When the plan expires
    planType: {
      type: String,
      enum: ["annual", "monthly", "none"],
      default: "none",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model("Payment", paymentSchema);
