import mongoose from "mongoose";

const GameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: "Game",
  },
  seasonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Season",
    required: true,
  },
  videos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Game = mongoose.model("Game", GameSchema);
