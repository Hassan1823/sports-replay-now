// Season & Game routes
import express from "express";
import {
  createSeason,
  getSeasons,
  renameSeason,
  deleteSeason,
  addGameToSeason,
  getGamesForSeason,
  renameGame,
  deleteGame,
  getVideosForGame,
  getGameDetails,
  getVideoDetails,
  updateVideoFile,
  deleteVideo,
  renameVideo,
  moveVideoToGame,
  moveGameToSeason,
  addSharedVideoToLibrary,
  checkVideoOwnership,
} from "../controller/season.controller.js";
import {
  uploadVideoToGame,
  uploadMultipleVideosToGame,
} from "../controller/season.controller.js";
import { singleUpload, multipleUpload } from "../middlewares/video.multer.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Season endpoints
router.post("/create-folder", createSeason); // POST /api/v1/seasons/create-folder
router.get("/get-seasons/:userId", getSeasons); // GET /api/v1/seasons/get-seasons/:userId
router.put("/rename-folder/:seasonId", renameSeason); // PUT /api/v1/seasons/rename-folder/:seasonId
router.delete("/delete-folder/:seasonId", deleteSeason); // DELETE /api/v1/seasons/delete-folder/:seasonId

// Game endpoints
router.post("/add-game/:seasonId", addGameToSeason); // POST /api/v1/seasons/add-game/:seasonId
router.get("/get-games/:seasonId", getGamesForSeason); // GET /api/v1/seasons/get-games/:seasonId
router.put("/rename-game/:gameId", renameGame); // PUT /api/v1/seasons/rename-game/:gameId
router.delete("/delete-game/:gameId", deleteGame); // DELETE /api/v1/seasons/delete-game/:gameId

// Video upload to game

// router.post("/upload-video/:gameId", singleUpload, uploadVideoToGame); // POST /api/v1/seasons/upload-video/:gameId

// Single video upload to game
router.post("/upload-video/:gameId", singleUpload, uploadVideoToGame); // POST /api/v1/seasons/upload-video/:gameId

// update video upload to game
router.post("/update-video/:videoId", singleUpload, updateVideoFile); // PUT /api/v1/seasons/upload-video/:gameId

// Multiple video upload to game (batch)
router.post(
  "/upload/batch/:gameId",
  multipleUpload,
  uploadMultipleVideosToGame
); // POST /api/v1/seasons/upload/batch/:gameId

// get videos for a game
router.get("/get-videos/:gameId", getVideosForGame);

// get game details with season info and videos
router.get("/get-game-details/:gameId", getGameDetails);

// get video details by videoId (from DB and PeerTube)
router.get("/get-video-details/:videoId", getVideoDetails);

// delete video by videoId
router.delete("/delete-video/:videoId", deleteVideo);

// rename video by videoId
router.put("/rename-video/:videoId", renameVideo);

// move video to different game
router.put("/move-video/:videoId", moveVideoToGame);

// move game to different season
router.put("/move-game/:gameId", moveGameToSeason);

// Add shared video to user's library
router.post("/add-shared-video-to-library", addSharedVideoToLibrary);

// Check if user owns a video
router.get("/check-video-ownership/:videoId", verifyJWT, checkVideoOwnership);

export default router;
