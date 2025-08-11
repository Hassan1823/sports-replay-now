import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    peertubeVideoId: {
      type: String,
      required: true,
    },
    videoShareLink: {
      type: String,
      required: false,
      default: "",
    },
    embedIframeUrl: {
      type: String,
      required: false,
      default: "",
    },
    videoDuration: {
      type: String,
      required: false,
      default: "",
    },
    videoChannel: {
      type: String,
      required: false,
      default: "",
    },
    videoThumbnail: {
      type: String,
      required: false,
      default: "",
    },
    peertubeChannelId: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    filePath: String,
    duration: Number,
    thumbnailPath: String,
    privacy: {
      type: Number,
      default: 1, // 1 = Public, 2 = Unlisted, 3 = Private
    },
    category: {
      type: Number,
      default: 1,
    },
    license: {
      type: Number,
      default: 1,
    },
    muteVideo: {
      type: Boolean,
      required: false,
      default: false,
    },
    tags: [String],
    uploadStatus: {
      type: String,
      enum: ["processing", "published", "failed"],
      default: "processing",
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
videoSchema.index({ userId: 1 });
videoSchema.index({ peertubeVideoId: 1 });

export const Video = mongoose.model("Video", videoSchema);
