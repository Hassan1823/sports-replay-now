import mongoose, { Schema } from "mongoose";

const peertubeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    peertubeUserId: {
      type: Number,
      required: true,
    },
    peertubeAccountId: {
      type: Number,
      required: true,
    },
    peertubeUsername: {
      type: String,
      required: true,
    },
    channelName: {
      type: String,
      required: false,
      default: null,
    },
    peertubeChannelId: {
      type: String,
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Peertube = mongoose.model("Peertube", peertubeSchema);
