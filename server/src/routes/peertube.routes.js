import { Router } from "express";
import {
  createPeerTubeUser,
  deletePeerTubeUser,
  deleteVideo,
  getPeerTubeUser,
  getVideoDetails,
  updatePeerTubeUser,
  uploadMultipleVideos,
  uploadVideoToPeerTube,
} from "../controller/peertube.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { singleUpload, multipleUpload } from "../middlewares/video.multer.js";
import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// * register peertube route
router.route("/create-user").post(createPeerTubeUser);

// * delete the peertube account
router.route("/delete-user").post(deletePeerTubeUser);

// * update the peertube account
router.route("/update-user/:userId").post(updatePeerTubeUser);

// * get the peertube account
router.route("/get-user/:userId").get(getPeerTubeUser);

// * upload video to peertube
router.route("/upload-video").post(
  upload.single("videoFile"), // Using multer middleware for file upload
  uploadVideoToPeerTube
);

// * get video details
router.route("/video/:videoId").get(getVideoDetails);

// * delete video
router.route("/delete-video").post(deleteVideo);

// & test routes for peertube

// Single video upload
router.route("/upload").post(singleUpload, uploadVideoToPeerTube);

// Multiple video upload (up to 5)
router.route("/upload/batch").post(multipleUpload, uploadMultipleVideos);

// Get user's videos
router.route("/user/:userId").get(
  verifyJWT,
  asyncHandler(async (req, res) => {
    const videos = await Video.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });

    const count = await Video.countDocuments({ userId: req.params.userId });

    return res.status(200).json({
      success: true,
      count,
      remainingQuota: MAX_USER_VIDEOS - count,
      data: videos,
    });
  })
);

// & ------------------------------------------------------
export default router;
