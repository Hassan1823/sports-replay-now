import { Video } from "../models/video.model.js";
import { Peertube } from "../models/peertube.model.js";
import { getAccessToken } from "../utils/peertubeAuth.js";
import fs from "fs";
import FormData from "form-data";
import axios from "axios";

// Season controller for CRUD operations and Game management
import { Season } from "../models/season.model.js";
import { Game } from "../models/game.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";

const unlinkAsync = promisify(fs.unlink);
const renameAsync = promisify(fs.rename);

// Helper function to mute video using FFmpeg
const muteVideoFile = async (inputPath) => {
  const tempPath = inputPath + ".muted.mp4";

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("copy") // Keep original audio (but we'll remove it)
      .videoCodec("copy") // Keep original video
      .outputOptions("-an") // This actually removes audio
      .on("error", (err) => {
        console.error("Error muting video:", err);
        reject(err);
      })
      .on("end", () => {
        resolve(tempPath);
      })
      .save(tempPath);
  });
};

// * upload single video to a game folder
export const uploadVideoToGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { name, description = "", privacy = "1", mute } = req.body;
  const videoFile = req.file;

  if (!gameId || !name || !videoFile) {
    return res.status(400).json({
      success: false,
      message: "Game ID, video name, and video file are required",
    });
  }

  const muteVideo = mute === "true" || mute === true;
  let finalVideoPath = videoFile.path;

  try {
    // Find the game
    const game = await Game.findById(gameId);
    if (!game) {
      return res
        .status(404)
        .json({ success: false, message: "Game not found" });
    }

    // Find the season to get userId
    const season = await Season.findById(game.seasonId);
    if (!season) {
      return res
        .status(404)
        .json({ success: false, message: "Season not found" });
    }

    // Find PeerTube account
    const peertubeAccount = await Peertube.findOne({ userId: season.userId });
    if (!peertubeAccount?.peertubeChannelId) {
      return res.status(404).json({
        success: false,
        message: "No PeerTube channel linked to this user",
      });
    }

    // Mute video if needed
    if (muteVideo) {
      try {
        console.log("🚀 Muting video before upload...");
        finalVideoPath = await muteVideoFile(videoFile.path);
        console.log("🚀 Video muted successfully:", finalVideoPath);
      } catch (error) {
        console.error(
          "🚀 Failed to mute video, proceeding with original:",
          error
        );
        // Continue with original file if muting fails
        finalVideoPath = videoFile.path;
      }
    }

    // Get video duration using ffmpeg
    const getVideoDuration = (filePath) =>
      new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) return reject(err);
          if (metadata && metadata.format && metadata.format.duration) {
            // Format duration as HH:MM:SS
            const totalSeconds = Math.floor(metadata.format.duration);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const formatted =
              (hours > 0 ? String(hours).padStart(2, "0") + ":" : "") +
              String(minutes).padStart(2, "0") +
              ":" +
              String(seconds).padStart(2, "0");
            resolve(formatted);
          } else {
            resolve("");
          }
        });
      });

    let videoDuration = "";
    try {
      videoDuration = await getVideoDuration(finalVideoPath);
    } catch (err) {
      console.error("Error getting video duration:", err);
      videoDuration = "";
    }

    // Prepare upload to PeerTube
    const token = await getAccessToken();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("channelId", peertubeAccount.peertubeChannelId.toString());
    formData.append("description", description);
    formData.append("privacy", privacy);
    formData.append("nsfw", "false");
    formData.append("commentsEnabled", "true");
    formData.append("downloadEnabled", "true");
    formData.append("category", req.body.category || "1");
    formData.append("license", req.body.license || "1");
    formData.append("language", req.body.language || "en");

    if (req.body.tags) {
      const tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : req.body.tags.split(",");
      tags.forEach((tag) => formData.append("tags[]", tag.trim()));
    }

    formData.append("videofile", fs.createReadStream(finalVideoPath), {
      filename: videoFile.originalname,
      contentType: videoFile.mimetype,
      knownLength: fs.statSync(finalVideoPath).size,
    });

    // Upload to PeerTube
    let uploadResponse;
    try {
      uploadResponse = await axios.post(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30 * 60 * 1000,
        }
      );
    } catch (error) {
      console.error("PeerTube upload failed:", error);
      // Clean up muted file if it exists
      if (finalVideoPath !== videoFile.path) {
        try {
          await unlinkAsync(finalVideoPath);
        } catch (unlinkError) {
          console.error("Error cleaning up muted file:", unlinkError);
        }
      }
      // Clean up original file
      if (videoFile?.path) {
        try {
          await unlinkAsync(videoFile.path);
        } catch {}
      }
      return res.status(500).json({
        success: false,
        message: "PeerTube upload failed",
        details: error.response?.data || error.message,
      });
    }

    // Fetch the video details from PeerTube to get previewPath and thumbnailPath
    let peertubeVideoDetails;
    try {
      const detailsRes = await axios.get(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${uploadResponse.data.video.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      peertubeVideoDetails = detailsRes.data;
    } catch (err) {
      console.error("Error fetching video details:", err);
      peertubeVideoDetails = uploadResponse.data.video; // fallback
    }

    // Compose full URLs for previewPath and thumbnailPath
    const peertubeBaseUrl =
      process.env.PEERTUBE_INSTANCE_URL || "https://video.visiononline.games";
    const previewPath = peertubeVideoDetails.previewPath
      ? peertubeBaseUrl.replace(/\/$/, "") + peertubeVideoDetails.previewPath
      : null;
    const thumbnailPath = peertubeVideoDetails.thumbnailPath
      ? peertubeBaseUrl.replace(/\/$/, "") + peertubeVideoDetails.thumbnailPath
      : null;

    // Save video metadata in DB
    const videoRecord = await Video.create({
      userId: season.userId,
      peertubeVideoId: uploadResponse.data.video.id,
      videoShareLink: peertubeVideoDetails.url || "",
      videoChannel: peertubeVideoDetails.channel.url || "",
      peertubeChannelId: peertubeAccount.peertubeChannelId,
      title: name,
      description,
      filePath: uploadResponse.data.video.url,
      duration: uploadResponse.data.video.duration,
      videoThumbnail: thumbnailPath || previewPath || "",
      privacy,
      category: req.body.category || 1,
      license: req.body.license || 1,
      tags: req.body.tags ? req.body.tags.split(",").map((t) => t.trim()) : [],
      uploadStatus: "published",
      muteVideo: muteVideo,
      videoDuration: videoDuration, // <-- Added field
    });

    // Add video to game
    await Game.findByIdAndUpdate(gameId, {
      $push: { videos: videoRecord._id },
    });

    // Clean up files
    try {
      if (finalVideoPath !== videoFile.path) {
        await unlinkAsync(finalVideoPath);
      }
      await unlinkAsync(videoFile.path);
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }

    return res.status(201).json({
      success: true,
      data: {
        video: videoRecord,
        peertube: peertubeVideoDetails,
        fullPreviewPath: previewPath,
        fullThumbnailPath: thumbnailPath,
      },
      message: `Video ${muteVideo ? "(muted) " : ""}uploaded and linked to game successfully`,
    });
  } catch (error) {
    // Clean up files in case of any error
    try {
      if (finalVideoPath !== videoFile.path) {
        await unlinkAsync(finalVideoPath);
      }
      if (videoFile?.path) {
        await unlinkAsync(videoFile.path);
      }
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    console.error("Error in uploadVideoToGame:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during video upload",
      error: error.message,
    });
  }
});

// * update peertube video
export const updateVideoFile = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const videoFile = req.file;
  const { duration } = req.body;
  console.log("🚀 ~ duration:", duration || "no duration");

  if (!videoId || !videoFile) {
    return res.status(400).json({
      success: false,
      message: "Video ID and video file are required",
    });
  }

  try {
    // Find the existing video record
    const existingVideo = await Video.findById(videoId);
    if (!existingVideo) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Find PeerTube account
    const peertubeAccount = await Peertube.findOne({
      userId: existingVideo.userId,
    });
    if (!peertubeAccount?.peertubeChannelId) {
      return res.status(404).json({
        success: false,
        message: "No PeerTube channel linked to this user",
      });
    }

    // Get access token
    const token = await getAccessToken();

    // Delete the old video from PeerTube
    try {
      await axios.delete(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${existingVideo.peertubeVideoId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error("Error deleting old video from PeerTube:", error);
      // Continue even if deletion fails (might be already deleted)
    }

    // Get video duration for the new video
    const getVideoDuration = (filePath) =>
      new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) return reject(err);
          if (metadata && metadata.format && metadata.format.duration) {
            // Format duration as HH:MM:SS
            const totalSeconds = Math.floor(metadata.format.duration);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const formatted =
              (hours > 0 ? String(hours).padStart(2, "0") + ":" : "") +
              String(minutes).padStart(2, "0") +
              ":" +
              String(seconds).padStart(2, "0");
            resolve(formatted);
          } else {
            resolve("");
          }
        });
      });

    let videoDuration = "";
    try {
      videoDuration = await getVideoDuration(videoFile.path);
    } catch (err) {
      console.error("Error getting video duration:", err);
      videoDuration = "";
    }

    // Prepare upload to PeerTube with the same metadata as before
    const formData = new FormData();
    formData.append("name", existingVideo.title);
    formData.append("channelId", peertubeAccount.peertubeChannelId.toString());
    formData.append("description", existingVideo.description);
    formData.append("privacy", existingVideo.privacy.toString());
    formData.append("nsfw", "false");
    formData.append("commentsEnabled", "true");
    formData.append("downloadEnabled", "true");
    formData.append("category", existingVideo.category?.toString() || "1");
    formData.append("license", existingVideo.license?.toString() || "1");
    formData.append("language", "en"); // Default language

    if (existingVideo.tags?.length > 0) {
      existingVideo.tags.forEach((tag) => formData.append("tags[]", tag));
    }

    formData.append("videofile", fs.createReadStream(videoFile.path), {
      filename: videoFile.originalname,
      contentType: videoFile.mimetype,
      knownLength: fs.statSync(videoFile.path).size,
    });

    // Upload new video to PeerTube
    let uploadResponse;
    try {
      uploadResponse = await axios.post(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30 * 60 * 1000,
        }
      );
    } catch (error) {
      console.error("PeerTube upload failed:", error);
      // Clean up uploaded file
      if (videoFile?.path) {
        try {
          await unlinkAsync(videoFile.path);
        } catch {}
      }
      return res.status(500).json({
        success: false,
        message: "PeerTube upload failed",
        details: error.response?.data || error.message,
      });
    }

    // Fetch the new video details from PeerTube
    let peertubeVideoDetails;
    try {
      const detailsRes = await axios.get(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${uploadResponse.data.video.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      peertubeVideoDetails = detailsRes.data;
    } catch (err) {
      console.error("Error fetching video details:", err);
      peertubeVideoDetails = uploadResponse.data.video; // fallback
    }

    // Compose full URLs for previewPath and thumbnailPath
    const peertubeBaseUrl =
      process.env.PEERTUBE_INSTANCE_URL || "https://video.visiononline.games";
    const previewPath = peertubeVideoDetails.previewPath
      ? peertubeBaseUrl.replace(/\/$/, "") + peertubeVideoDetails.previewPath
      : null;
    const thumbnailPath = peertubeVideoDetails.thumbnailPath
      ? peertubeBaseUrl.replace(/\/$/, "") + peertubeVideoDetails.thumbnailPath
      : null;

    // Update video metadata in DB, preserving all fields except the PeerTube-specific ones
    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        peertubeVideoId: uploadResponse.data.video.id,
        videoShareLink: peertubeVideoDetails.url || "",
        videoChannel: peertubeVideoDetails.channel.url || "",
        filePath: uploadResponse.data.video.url,
        duration: duration
          ? parseFloat(duration)
          : uploadResponse.data.video.duration,
        videoThumbnail: thumbnailPath || previewPath || "",
        videoDuration: videoDuration || existingVideo.videoDuration, // Use new duration or keep existing
        // Keep the original muteVideo status
        $setOnInsert: { muteVideo: existingVideo.muteVideo },
      },
      { new: true }
    );

    // Clean up uploaded file
    try {
      if (videoFile?.path) {
        await unlinkAsync(videoFile.path);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }

    return res.status(200).json({
      success: true,
      data: {
        video: updatedVideo,
        peertube: peertubeVideoDetails,
        fullPreviewPath: previewPath,
        fullThumbnailPath: thumbnailPath,
      },
      message: "Video file updated successfully",
    });
  } catch (error) {
    // Clean up files in case of any error
    try {
      if (videoFile?.path) {
        await unlinkAsync(videoFile.path);
      }
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    console.error("Error in updateVideoFile:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during video update",
      error: error.message,
    });
  }
});

// * upload single video to a game folder
// export const uploadVideoToGame = asyncHandler(async (req, res) => {
//   const { gameId } = req.params;
//   const { name, description = "", privacy = "1", mute } = req.body;
//   const videoFile = req.file;

//   if (!gameId || !name || !videoFile) {
//     return res.status(400).json({
//       success: false,
//       message: "Game ID, video name, and video file are required",
//     });
//   }

//   let muteVideo = mute || false;
//   console.log("🚀 ~ uploadVideoToGame ~ muteVideo:", muteVideo);

//   // Find the game
//   const game = await Game.findById(gameId);
//   if (!game) {
//     return res.status(404).json({ success: false, message: "Game not found" });
//   }

//   // Find the season to get userId
//   const season = await Season.findById(game.seasonId);
//   if (!season) {
//     return res
//       .status(404)
//       .json({ success: false, message: "Season not found" });
//   }

//   // Find PeerTube account
//   const peertubeAccount = await Peertube.findOne({ userId: season.userId });
//   if (!peertubeAccount?.peertubeChannelId) {
//     return res.status(404).json({
//       success: false,
//       message: "No PeerTube channel linked to this user",
//     });
//   }

//   // Prepare upload to PeerTube
//   const token = await getAccessToken();
//   const formData = new FormData();
//   formData.append("name", name);
//   formData.append("channelId", peertubeAccount.peertubeChannelId.toString());
//   formData.append("description", description);
//   formData.append("privacy", privacy);
//   formData.append("nsfw", "false");
//   formData.append("commentsEnabled", "true");
//   formData.append("downloadEnabled", "true");
//   formData.append("category", req.body.category || "1");
//   formData.append("license", req.body.license || "1");
//   formData.append("language", req.body.language || "en");
//   if (req.body.tags) {
//     const tags = Array.isArray(req.body.tags)
//       ? req.body.tags
//       : req.body.tags.split(",");
//     tags.forEach((tag) => formData.append("tags[]", tag.trim()));
//   }
//   formData.append("videofile", fs.createReadStream(videoFile.path), {
//     filename: videoFile.originalname,
//     contentType: videoFile.mimetype,
//     knownLength: fs.statSync(videoFile.path).size,
//   });

//   // Upload to PeerTube
//   let uploadResponse;
//   try {
//     uploadResponse = await axios.post(
//       `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/upload`,
//       formData,
//       {
//         headers: {
//           ...formData.getHeaders(),
//           Authorization: `Bearer ${token}`,
//         },
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//         timeout: 30 * 60 * 1000,
//       }
//     );
//   } catch (error) {
//     if (videoFile?.path) {
//       try {
//         fs.unlinkSync(videoFile.path);
//       } catch {}
//     }
//     return res.status(500).json({
//       success: false,
//       message: "PeerTube upload failed",
//       details: error.response?.data || error.message,
//     });
//   }

//   // Fetch the video details from PeerTube to get previewPath and thumbnailPath
//   let peertubeVideoDetails;
//   try {
//     const detailsRes = await axios.get(
//       `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${uploadResponse.data.video.id}`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );
//     peertubeVideoDetails = detailsRes.data;
//   } catch (err) {
//     peertubeVideoDetails = uploadResponse.data.video; // fallback
//   }

//   // Compose full URLs for previewPath and thumbnailPath
//   const peertubeBaseUrl =
//     process.env.PEERTUBE_INSTANCE_URL || "https://video.visiononline.games";
//   const previewPath = peertubeVideoDetails.previewPath
//     ? peertubeBaseUrl.replace(/\/$/, "") + peertubeVideoDetails.previewPath
//     : null;
//   const thumbnailPath = peertubeVideoDetails.thumbnailPath
//     ? peertubeBaseUrl.replace(/\/$/, "") + peertubeVideoDetails.thumbnailPath
//     : null;

//   // Save video metadata in DB
//   const videoRecord = await Video.create({
//     userId: season.userId,
//     peertubeVideoId: uploadResponse.data.video.id,
//     peertubeChannelId: peertubeAccount.peertubeChannelId,
//     title: name,
//     description,
//     filePath: uploadResponse.data.video.url,
//     duration: uploadResponse.data.video.duration,
//     videoThumbnail: thumbnailPath || previewPath || "",
//     privacy,
//     category: req.body.category || 1,
//     license: req.body.license || 1,
//     tags: req.body.tags ? req.body.tags.split(",").map((t) => t.trim()) : [],
//     uploadStatus: "published",
//     muteVideo: muteVideo,
//   });

//   // Add video to game
//   await Game.findByIdAndUpdate(gameId, { $push: { videos: videoRecord._id } });

//   // Clean up
//   fs.unlinkSync(videoFile.path);

//   // Log the full previewPath and thumbnailPath
//   if (previewPath) {
//     console.log("Full previewPath:", previewPath);
//   }
//   if (thumbnailPath) {
//     console.log("Full thumbnailPath:", thumbnailPath);
//   }

//   return res.status(201).json({
//     success: true,
//     data: {
//       video: videoRecord,
//       peertube: peertubeVideoDetails,
//       fullPreviewPath: previewPath,
//       fullThumbnailPath: thumbnailPath,
//     },
//     message: "Video uploaded and linked to game successfully",
//   });
// });
// ----------------------------

// * upload multiple videos to a game folder

export const uploadMultipleVideosToGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const {
    name,
    description = "",
    privacy = "1",
    category = "1",
    license = "1",
    language = "en",
    tags = "",
  } = req.body;
  const files = req.files;

  if (!gameId || !files || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Game ID and at least one video file are required",
    });
  }

  // Find the game
  const game = await Game.findById(gameId);
  if (!game) {
    return res.status(404).json({ success: false, message: "Game not found" });
  }

  // Find the season to get userId
  const season = await Season.findById(game.seasonId);
  if (!season) {
    return res
      .status(404)
      .json({ success: false, message: "Season not found" });
  }

  // Find PeerTube account
  const peertubeAccount = await Peertube.findOne({ userId: season.userId });
  if (!peertubeAccount?.peertubeChannelId) {
    return res.status(404).json({
      success: false,
      message: "No PeerTube channel linked to this user",
    });
  }

  const token = await getAccessToken();
  const results = [];

  for (const videoFile of files) {
    const formData = new FormData();
    formData.append("name", name || videoFile.originalname);
    formData.append("channelId", peertubeAccount.peertubeChannelId.toString());
    formData.append("description", description);
    formData.append("privacy", privacy);
    formData.append("nsfw", "false");
    formData.append("commentsEnabled", "true");
    formData.append("downloadEnabled", "true");
    formData.append("category", category);
    formData.append("license", license);
    formData.append("language", language);
    if (tags) {
      const tagsArr = Array.isArray(tags) ? tags : tags.split(",");
      tagsArr.forEach((tag) => formData.append("tags[]", tag.trim()));
    }
    formData.append("videofile", fs.createReadStream(videoFile.path), {
      filename: videoFile.originalname,
      contentType: videoFile.mimetype,
      knownLength: fs.statSync(videoFile.path).size,
    });

    let uploadResponse;
    try {
      uploadResponse = await axios.post(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30 * 60 * 1000,
        }
      );
    } catch (error) {
      if (videoFile?.path) {
        try {
          fs.unlinkSync(videoFile.path);
        } catch {}
      }
      results.push({
        success: false,
        file: videoFile.originalname,
        error: error.response?.data || error.message,
      });
      continue;
    }

    // Save video metadata in DB
    const videoRecord = await Video.create({
      userId: season.userId,
      peertubeVideoId: uploadResponse.data.video.id,
      peertubeChannelId: peertubeAccount.peertubeChannelId,
      title: name || videoFile.originalname,
      description,
      filePath: uploadResponse.data.video.url,
      duration: uploadResponse.data.video.duration,
      thumbnailPath: uploadResponse.data.video.thumbnailPath,
      privacy,
      category,
      license,
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      uploadStatus: "published",
    });

    // Add video to game
    await Game.findByIdAndUpdate(gameId, {
      $push: { videos: videoRecord._id },
    });

    // Clean up
    fs.unlinkSync(videoFile.path);

    results.push({
      success: true,
      video: videoRecord,
      peertube: uploadResponse.data.video,
    });
  }

  return res.status(207).json({
    success: true,
    results,
    message: "Batch video upload completed for game folder",
  });
});

//* Create a new Season
export const createSeason = asyncHandler(async (req, res) => {
  const { name, userId } = req.body;
  if (!name || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Season name and userId required" });
  }
  const season = await Season.create({ name, userId });
  return res
    .status(201)
    .json({ success: true, data: season, message: "Season created" });
});

//* Get all Seasons for a user
export const getSeasons = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const seasons = await Season.find({ userId }).populate("games");
  return res.status(200).json({ success: true, data: seasons });
});

//* Rename a Season
export const renameSeason = asyncHandler(async (req, res) => {
  const { seasonId } = req.params;
  const { name } = req.body;
  const season = await Season.findByIdAndUpdate(
    seasonId,
    { name },
    { new: true }
  );
  if (!season)
    return res
      .status(404)
      .json({ success: false, message: "Season not found" });
  return res
    .status(200)
    .json({ success: true, data: season, message: "Season renamed" });
});

//* Delete a Season
// export const deleteSeason = asyncHandler(async (req, res) => {
//   const { seasonId } = req.params;
//   const season = await Season.findByIdAndDelete(seasonId);
//   if (!season)
//     return res
//       .status(404)
//       .json({ success: false, message: "Season not found" });
//   return res.status(200).json({ success: true, message: "Season deleted" });
// });

// * delete season video and games
export const deleteSeason = asyncHandler(async (req, res) => {
  const { seasonId } = req.params;

  // Find the season
  const season = await Season.findById(seasonId);
  if (!season)
    return res
      .status(404)
      .json({ success: false, message: "Season not found" });

  // Find all games related to the season
  const games = await Game.find({ seasonId: season._id });

  // Collect all video IDs from all games
  const videoIds = [];
  for (const game of games) {
    if (Array.isArray(game.videos)) {
      videoIds.push(...game.videos);
    }
  }

  // Find all video docs
  const videos = await Video.find({ _id: { $in: videoIds } });

  // Get PeerTube access token
  const token = await getAccessToken();

  // Delete videos from PeerTube
  for (const video of videos) {
    if (video.peertubeVideoId) {
      try {
        await axios.delete(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${video.peertubeVideoId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (err) {
        // Ignore PeerTube deletion errors, continue
      }
    }
  }

  // Delete videos from DB
  await Video.deleteMany({ _id: { $in: videoIds } });

  // Delete games from DB
  await Game.deleteMany({ seasonId: season._id });

  // Delete season from DB
  await Season.findByIdAndDelete(seasonId);

  return res.status(200).json({
    success: true,
    message: "Season, related games, and videos deleted",
  });
});

//* Add a Game to a Season
export const addGameToSeason = asyncHandler(async (req, res) => {
  const { seasonId } = req.params;
  const { name } = req.body;
  if (!name)
    return res
      .status(400)
      .json({ success: false, message: "Game name required" });
  const game = await Game.create({ name, seasonId });
  await Season.findByIdAndUpdate(seasonId, { $push: { games: game._id } });
  return res
    .status(201)
    .json({ success: true, data: game, message: "Game added to season" });
});

//* Get all Games for a Season
export const getGamesForSeason = asyncHandler(async (req, res) => {
  const { seasonId } = req.params;
  const games = await Game.find({ seasonId });
  return res.status(200).json({ success: true, data: games });
});

//* Rename a Game
export const renameGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const { name } = req.body;
  const game = await Game.findByIdAndUpdate(gameId, { name }, { new: true });
  if (!game)
    return res.status(404).json({ success: false, message: "Game not found" });
  return res
    .status(200)
    .json({ success: true, data: game, message: "Game renamed" });
});

//* Delete a Game
export const deleteGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;

  // Find the game
  const game = await Game.findById(gameId);
  if (!game)
    return res.status(404).json({ success: false, message: "Game not found" });

  // Collect all video IDs from the game
  const videoIds = Array.isArray(game.videos) ? game.videos : [];

  // Find all video docs
  const videos = await Video.find({ _id: { $in: videoIds } });

  // Get PeerTube access token
  const token = await getAccessToken();

  // Delete videos from PeerTube
  for (const video of videos) {
    if (video.peertubeVideoId) {
      try {
        await axios.delete(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${video.peertubeVideoId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (err) {
        // Ignore PeerTube deletion errors, continue
      }
    }
  }

  // Delete videos from DB
  await Video.deleteMany({ _id: { $in: videoIds } });

  // Delete the game from DB
  await Game.findByIdAndDelete(gameId);

  // Remove game reference from any season
  await Season.updateMany({}, { $pull: { games: gameId } });

  return res
    .status(200)
    .json({ success: true, message: "Game and related videos deleted" });
});
// * default delete game
// export const deleteGame = asyncHandler(async (req, res) => {
//   const { gameId } = req.params;
//   const game = await Game.findByIdAndDelete(gameId);
//   if (!game)
//     return res.status(404).json({ success: false, message: "Game not found" });
//   await Season.updateMany({}, { $pull: { games: gameId } });
//   return res.status(200).json({ success: true, message: "Game deleted" });
// });

// * Get all videos for a Game
export const getVideosForGame = asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  if (!gameId) {
    return res.status(400).json({
      success: false,
      message: "Game ID is required",
    });
  }
  const game = await Game.findById(gameId).populate("videos");
  if (!game) {
    return res.status(404).json({ success: false, message: "Game not found" });
  }
  if (!game.videos || game.videos.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
      message: "No videos found for this game",
    });
  }
  return res.status(200).json({ success: true, data: game.videos });
});

// * Get video details by videoId (from DB and PeerTube)
export const getVideoDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({
      success: false,
      message: "Video ID is required",
    });
  }

  // Find video in DB to get PeerTube video ID
  const videoDoc = await Video.findById(videoId);
  if (!videoDoc || !videoDoc.peertubeVideoId) {
    return res.status(404).json({
      success: false,
      message: "Video not found or missing PeerTube ID",
    });
  }

  const token = await getAccessToken();
  try {
    const response = await axios.get(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${videoDoc.peertubeVideoId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(200).json({
      success: true,
      data: response.data,
      message: "Video details fetched from PeerTube",
    });
  } catch (error) {
    console.log("🚀 ~ getVideoDetails ~ error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch video details from PeerTube",
      details: error.response?.data || error.message,
    });
  }
});

// * delete video
export const deleteVideo = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Video ID is required",
      });
    }

    // Find the video in the database
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Get PeerTube access token
    const token = await getAccessToken();

    // Delete video from PeerTube if it has a peertubeVideoId
    if (video.peertubeVideoId) {
      try {
        await axios.delete(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${video.peertubeVideoId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log(`Video ${video.peertubeVideoId} deleted from PeerTube`);
      } catch (error) {
        console.error("Error deleting video from PeerTube:", error);
        // Continue with database deletion even if PeerTube deletion fails
        // (video might have been already deleted from PeerTube)
      }
    }

    // Find the game that contains this video
    const game = await Game.findOne({ videos: videoId });
    if (game) {
      // Remove the video from the game's videos array
      await Game.findByIdAndUpdate(game._id, {
        $pull: { videos: videoId },
      });
      console.log(`Video removed from game ${game._id}`);
    }

    // Delete the video from the database
    await Video.findByIdAndDelete(videoId);
    console.log(`Video ${videoId} deleted from database`);

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully from PeerTube and database",
    });
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      details: error.response?.data || error.message,
    });
  }
});

// * rename video
export const renameVideo = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    const { title } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Video ID is required",
      });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Video title is required",
      });
    }

    // Find the video in the database
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Update the video title in the database
    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { title: title.trim() },
      { new: true }
    );

    // Update the video title in PeerTube if it has a peertubeVideoId
    if (video.peertubeVideoId) {
      try {
        const token = await getAccessToken();
        await axios.put(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${video.peertubeVideoId}`,
          {
            name: title.trim(),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log(`Video ${video.peertubeVideoId} title updated in PeerTube`);
      } catch (error) {
        console.error("Error updating video title in PeerTube:", error);
        // Continue with database update even if PeerTube update fails
        // The database will still be updated
      }
    }

    return res.status(200).json({
      success: true,
      message: "Video renamed successfully",
      data: {
        videoId: updatedVideo._id,
        title: updatedVideo.title,
      },
    });
  } catch (error) {
    console.log("🚀 ~ renameVideo ~ error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      details: error.response?.data || error.message,
    });
  }
});
