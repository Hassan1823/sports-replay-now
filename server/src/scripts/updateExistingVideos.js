import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import dotenv from "dotenv";

dotenv.config();

const updateExistingVideos = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all videos that don't have embedIframeUrl
    const videosWithoutEmbedUrl = await Video.find({
      $or: [
        { embedIframeUrl: { $exists: false } },
        { embedIframeUrl: "" },
        { embedIframeUrl: null },
      ],
    });

    console.log(
      `Found ${videosWithoutEmbedUrl.length} videos without embedIframeUrl`
    );

    if (videosWithoutEmbedUrl.length === 0) {
      console.log("All videos already have embedIframeUrl");
      return;
    }

    // Update each video
    let updatedCount = 0;
    for (const video of videosWithoutEmbedUrl) {
      try {
        const peertubeBaseUrl =
          process.env.PEERTUBE_INSTANCE_URL ||
          "https://video.sportsreplaynow.com";

        // We need to get the UUID from PeerTube API or construct it from existing data
        // For now, we'll construct it using the peertubeVideoId as a fallback
        // In a real scenario, you might want to fetch this from PeerTube API

        // Try to construct embedIframeUrl using peertubeVideoId
        // Note: This is a fallback - ideally you'd get the UUID from PeerTube
        const embedIframeUrl = `${peertubeBaseUrl}/videos/embed/${video.peertubeVideoId}`;

        await Video.findByIdAndUpdate(video._id, {
          embedIframeUrl: embedIframeUrl,
        });

        updatedCount++;
        console.log(
          `Updated video ${video._id} with embedIframeUrl: ${embedIframeUrl}`
        );
      } catch (error) {
        console.error(`Error updating video ${video._id}:`, error.message);
      }
    }

    console.log(`Successfully updated ${updatedCount} videos`);
  } catch (error) {
    console.error("Error updating videos:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
updateExistingVideos();
