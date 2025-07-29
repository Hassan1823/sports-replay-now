import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    // username: {
    //   type: String,
    //   required: true,
    //   unique: true,
    //   lowercase: true,
    //   trim: true,
    //   index: true,
    // },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: false,
    },
    phone: {
      type: Number,
      required: false,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
    stripePaymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "canceled"],
      default: "pending",
      required: false,
    },

    // peertube id
    peertubeId: {
      type: Schema.Types.ObjectId,
      ref: "Peertube",
      required: false,
    },

    // stripe payment id
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
