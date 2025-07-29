import mongoose from "mongoose";

const SeasonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: "Season",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  games: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
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

export const Season = mongoose.model("Season", SeasonSchema);
