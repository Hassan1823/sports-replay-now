import axios from "axios";
import { Peertube } from "../models/peertube.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getAccessToken } from "../utils/peertubeAuth.js";
import fs from "fs";
import FormData from "form-data";
import { Video } from "../models/video.model.js";

const generateRandomSuffix = () => {
  return Math.random().toString(36).substring(2, 8); // 6-character random string
};

//* create the peertube account for user
const createPeerTubeUser = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Email and password are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Please provide a valid email address",
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        code: "WEAK_PASSWORD",
        message: "Password must be at least 8 characters long",
      });
    }

    const token = await getAccessToken();
    const instanceHost = new URL(process.env.PEERTUBE_INSTANCE_URL).hostname;

    // Generate base username from email
    const emailPrefix = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 15); // Truncate to 15 chars to leave room for suffix

    let username;
    let isUnique = false;

    // Keep trying until we find a unique username or hit max attempts
    while (!isUnique && attempts < maxAttempts) {
      attempts++;
      username = `${emailPrefix}_${generateRandomSuffix()}`;

      try {
        // Check if username exists
        await axios.get(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/accounts/${username}@${instanceHost}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // If no error, username exists - try again
      } catch (error) {
        if (error.response?.status === 404) {
          isUnique = true;
        } else {
          throw error;
        }
      }
    }

    if (!isUnique) {
      return res.status(409).json({
        success: false,
        code: "USERNAME_GENERATION_FAILED",
        message:
          "Could not generate an available username after multiple attempts",
      });
    }

    // 1. Create PeerTube user account
    const userResponse = await axios.post(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users`,
      {
        username,
        email,
        password,
        role: 2,
        videoQuota: 1073741824,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const peertubeUserId = userResponse.data.user.id;
    const accountId = userResponse.data.user.account.id;

    // 2. Create channel with retry logic
    let channelResponse;
    let channelName = `${username}_chn`;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        channelResponse = await axios.post(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/video-channels`,
          {
            displayName: `${username}'s Channel`,
            name: channelName,
            ownerAccountId: accountId,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        break; // Success, exit loop
      } catch (error) {
        attempts++;
        if (error.response?.status === 409 && attempts < maxAttempts) {
          channelName = `${username}_chn_${attempts}`;
          continue;
        }
        throw error;
      }
    }

    if (!channelResponse) {
      return {
        success: false,
        code: "CHANNEL_CREATION_FAILED",
        message: "Failed to create channel after multiple attempts",
      };
    }

    // Debug: Log the complete channel response
    console.log("Channel creation response:", {
      status: channelResponse.status,
      data: channelResponse.data,
      channelId: channelResponse.data.id, // This should exist
    });

    // Prepare response
    const responseData = {
      user: {
        id: peertubeUserId,
        username,
        email,
        accountId,
        channelId: channelResponse.data.id, // Now properly referenced
      },
      urls: {
        account: `${process.env.PEERTUBE_INSTANCE_URL}/accounts/${username}`,
        channel: `${process.env.PEERTUBE_INSTANCE_URL}/video-channels/${channelName}`,
      },
    };

    return {
      success: true,
      data: responseData,
      message: "PeerTube account created successfully!",
    };
  } catch (error) {
    console.error(
      "PeerTube user creation error:",
      error.response?.data || error.message
    );

    // Handle username/account conflicts specifically
    if (error.response?.status === 409) {
      return res.status(409).json({
        success: false,
        code: "CONFLICT",
        message:
          "The system could not create a unique identity. Please try again.",
      });
    }

    // Handle other API errors
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        code: error.response.data.code || "PEERTUBE_API_ERROR",
        message:
          error.response.data.message || "PeerTube account creation failed",
      });
    }

    // Handle network/other errors
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }
});

//* default function to create the account

const createPeerTubeAccount = async (email, password, userId) => {
  try {
    const token = await getAccessToken();
    const instanceHost = new URL(process.env.PEERTUBE_INSTANCE_URL).hostname;

    // Use MongoDB _id as the username - guaranteed unique
    const username = userId.toString();

    // 1. Create PeerTube user account
    const userResponse = await axios.post(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users`,
      {
        username,
        email,
        password,
        role: 2, // Standard user role
        videoQuota: 1073741824, // 1GB quota
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const peertubeUserId = userResponse.data.user.id;
    const accountId = userResponse.data.user.account.id;

    // 2. Create channel - use the same username for consistency
    let channelResponse;
    let channelName = `${username}_chn`;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        channelResponse = await axios.post(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/video-channels`,
          {
            displayName: `${username}'s Channel`,
            name: channelName,
            ownerAccountId: accountId,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        break; // Success, exit loop
      } catch (error) {
        attempts++;
        if (error.response?.status === 409 && attempts < maxAttempts) {
          // If channel name exists, try with attempt number
          channelName = `${username}_chn_${attempts}`;
          continue;
        }
        throw error;
      }
    }

    if (!channelResponse) {
      return {
        success: false,
        code: "CHANNEL_CREATION_FAILED",
        message: "Failed to create channel after multiple attempts",
      };
    }

    // Extract channel ID from response
    const channelId =
      channelResponse.data.videoChannel?.id ||
      channelResponse.data.id ||
      channelResponse.data.channel?.id;

    if (!channelId) {
      console.error("Channel ID not found in response:", channelResponse.data);
      return {
        success: false,
        code: "CHANNEL_ID_MISSING",
        message: "Channel was created but ID could not be determined",
      };
    }

    // Prepare response to match what your payment controller expects
    return {
      success: true,
      data: {
        user: {
          id: peertubeUserId,
          username,
          email,
          accountId,
          channelId,
          channelName,
        },
        urls: {
          account: `${process.env.PEERTUBE_INSTANCE_URL}/accounts/${username}`,
          channel: `${process.env.PEERTUBE_INSTANCE_URL}/video-channels/${channelName}`,
        },
      },
      message: "PeerTube account created successfully",
    };
  } catch (error) {
    console.error(
      "PeerTube account creation error:",
      error.response?.data || error.message
    );

    // Handle conflicts (username/email already exists)
    if (error.response?.status === 409) {
      return {
        success: false,
        code: "CONFLICT",
        message:
          error.response.data?.message || "PeerTube account already exists",
      };
    }

    // Handle other API errors
    if (error.response) {
      return {
        success: false,
        code: error.response.data?.code || "PEERTUBE_API_ERROR",
        message:
          error.response.data?.message || "PeerTube account creation failed",
      };
    }

    // Handle network/other errors
    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred while creating PeerTube account",
    };
  }
};

// * delete the peertube account
const deletePeerTubeUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body || req.params; // This is the MongoDB user ID
    console.log("🚀 ~ deletePeerTubeUser ~ userId:", userId || "no user id");

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "User ID is required",
      });
    }

    // Check if user exists in our database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found in our system",
      });
    }

    // Get PeerTube account details from our database
    const peertubeAccount = await Peertube.findOne({ userId });
    if (!peertubeAccount) {
      return res.status(404).json({
        success: false,
        code: "PEERTUBE_ACCOUNT_NOT_FOUND",
        message: "No PeerTube account linked to this user",
      });
    }

    const token = await getAccessToken();
    const peertubeUserId = peertubeAccount.peertubeUserId;

    // Step 1: Delete all user videos first (if needed)
    try {
      await axios.delete(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users/${peertubeUserId}/videos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error(
        "Error deleting user videos:",
        error.response?.data || error.message
      );
      // Continue even if video deletion fails
    }

    // Step 2: Delete the PeerTube user account
    let deletionResponse;
    try {
      deletionResponse = await axios.delete(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users/${peertubeUserId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error(
        "Error deleting PeerTube account:",
        error.response?.data || error.message
      );

      if (error.response?.status === 404) {
        // If PeerTube account not found, we should still clean up our DB
        await Peertube.findOneAndDelete({ userId });
        return res.status(404).json({
          success: false,
          code: "PEERTUBE_USER_NOT_FOUND",
          message: "PeerTube user not found (local record deleted)",
        });
      }

      if (error.response?.status === 403) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          message: "Insufficient permissions to delete this account",
        });
      }

      throw error;
    }

    // Step 3: Delete from our database
    await Peertube.findOneAndDelete({ userId });

    // Step 4: Optionally update user document to remove reference
    await User.findByIdAndUpdate(
      userId,
      {
        $unset: { peertubeAccountId: 1 },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      data: {
        mongoUserId: userId,
        deletedPeerTubeUserId: peertubeUserId,
        deletedPeerTubeAccountId: peertubeAccount.peertubeAccountId,
        deletedPeerTubeUsername: peertubeAccount.peertubeUsername,
      },
      message: "PeerTube account and local records deleted successfully",
    });
  } catch (error) {
    console.error(
      "PeerTube user deletion error:",
      error.response?.data || error.message
    );

    // Handle specific API errors
    if (error.response) {
      const { status, data } = error.response;

      // Handle rate limiting
      if (status === 429) {
        return res.status(429).json({
          success: false,
          code: "RATE_LIMITED",
          message: "Too many requests to PeerTube API",
          retryAfter: error.response.headers["retry-after"] || 60,
        });
      }

      // Handle server errors
      if (status >= 500) {
        return res.status(502).json({
          success: false,
          code: "PEERTUBE_SERVER_ERROR",
          message: "PeerTube server error during account deletion",
        });
      }

      return res.status(status).json({
        success: false,
        type: data.type || "about:blank",
        title: data.title || "PeerTube Error",
        detail: data.detail || data.message || "Account deletion failed",
        status: status,
        code: data.code || "PEERTUBE_API_ERROR",
        errors: data.errors || null,
      });
    }

    // Handle network/other errors
    return res.status(500).json({
      success: false,
      code: "NETWORK_ERROR",
      message: "Unable to connect to PeerTube server",
    });
  }
});

// * update the peertube account
const updatePeerTubeUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      peertubeUsername, // Only updating fields that exist in the model
      peertubeAccountId,
      peertubeChannelId,
    } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_USER_ID",
        message: "User ID is required",
      });
    }

    // Get existing record
    const existingAccount = await Peertube.findOne({ userId });
    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message: "No PeerTube account linked to this user",
      });
    }

    const token = await getAccessToken();
    const instanceHost = new URL(process.env.PEERTUBE_INSTANCE_URL).hostname;
    const updates = {};
    const peertubeUpdates = {};

    // 1. Handle username update (if provided and different)
    if (
      peertubeUsername &&
      peertubeUsername !== existingAccount.peertubeUsername
    ) {
      // Validate username format
      const usernameRegex = /^[a-z0-9_]+$/;
      if (!usernameRegex.test(peertubeUsername)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_USERNAME",
          message:
            "Username can only contain lowercase letters, numbers and underscores",
        });
      }

      // Check if username is available
      try {
        await axios.get(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/accounts/${peertubeUsername}@${instanceHost}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return res.status(409).json({
          success: false,
          code: "USERNAME_EXISTS",
          message: "This username is already taken",
        });
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Update in PeerTube
      try {
        await axios.put(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users/${existingAccount.peertubeUserId}`,
          { username: peertubeUsername },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        updates.peertubeUsername = peertubeUsername;
        peertubeUpdates.username = peertubeUsername;
      } catch (error) {
        console.error(
          "PeerTube username update error:",
          error.response?.data || error.message
        );
        throw error;
      }
    }

    // 2. Handle channel ID update (if provided)
    if (
      peertubeChannelId &&
      peertubeChannelId !== existingAccount.peertubeChannelId
    ) {
      updates.peertubeChannelId = peertubeChannelId;
      // Note: PeerTube doesn't directly allow channel ID changes via API
      // This would just update our local reference
    }

    // 3. Update MongoDB if any changes
    if (Object.keys(updates).length > 0) {
      await Peertube.findOneAndUpdate(
        { userId },
        { $set: updates },
        { new: true }
      );
    }

    // 4. Get updated PeerTube account info
    let accountInfo;
    try {
      const response = await axios.get(
        `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users/${existingAccount.peertubeUserId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      accountInfo = response.data;
    } catch (error) {
      console.error("Error fetching updated account info:", error);
      accountInfo = "Could not fetch updated info";
    }

    return res.status(200).json({
      success: true,
      data: {
        mongoRecord: await Peertube.findOne({ userId }),
        peertubeAccount: accountInfo,
        updatedFields: Object.keys(updates),
      },
      message: "PeerTube account updated successfully",
    });
  } catch (error) {
    console.error("Update error:", error.response?.data || error.message);

    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: error.response.data?.message || "Invalid request to PeerTube",
        errors: error.response.data?.errors,
      });
    }

    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Failed to update PeerTube account",
    });
  }
});

// * get peertube user
const getPeerTubeUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params || req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_USER_ID",
        message: "User ID is required",
      });
    }

    // 1. Get data from our MongoDB first
    const localData = await Peertube.findOne({ userId })
      .populate("userId", "username email") // Include basic user info if needed
      .lean();

    if (!localData) {
      return res.status(404).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message: "No PeerTube account linked to this user",
      });
    }

    const token = await getAccessToken();
    const instanceHost = new URL(process.env.PEERTUBE_INSTANCE_URL).hostname;
    let peertubeData = null;

    // 2. Get data from PeerTube API if we have the user ID
    if (localData.peertubeUserId) {
      try {
        const response = await axios.get(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/users/${localData.peertubeUserId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        peertubeData = response.data;
      } catch (error) {
        console.error(
          "Error fetching PeerTube user data:",
          error.response?.data || error.message
        );
        // Continue even if we can't get PeerTube data
      }
    }

    // 3. Get account details if we have the username
    let accountData = null;
    if (localData.peertubeUsername) {
      try {
        const response = await axios.get(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/accounts/${localData.peertubeUsername}@${instanceHost}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        accountData = response.data;
      } catch (error) {
        console.error(
          "Error fetching PeerTube account data:",
          error.response?.data || error.message
        );
      }
    }

    // 4. Get channel details if we have the channel ID
    let channelData = null;
    if (localData.peertubeChannelId) {
      try {
        const response = await axios.get(
          `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/video-channels/${localData.peertubeChannelId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        channelData = response.data;
      } catch (error) {
        console.error(
          "Error fetching PeerTube channel data:",
          error.response?.data || error.message
        );
      }
    }

    // 5. Format the combined response
    const responseData = {
      localData: {
        _id: localData._id,
        userId: localData.userId,
        peertubeUserId: localData.peertubeUserId,
        peertubeAccountId: localData.peertubeAccountId,
        peertubeUsername: localData.peertubeUsername,
        peertubeChannelId: localData.peertubeChannelId,
        createdAt: localData.createdAt,
        updatedAt: localData.updatedAt,
      },
      peertubeData: peertubeData || "Not available",
      accountData: accountData || "Not available",
      channelData: channelData || "Not available",
    };

    return res.status(200).json({
      success: true,
      data: responseData,
      message: "PeerTube account data retrieved successfully",
    });
  } catch (error) {
    console.error("Get PeerTube user error:", error);

    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Failed to retrieve PeerTube account data",
      error: error.message,
    });
  }
});

// ~ peertube -------------------------------

// //* Upload video to PeerTube
// const uploadVideoToPeerTube = asyncHandler(async (req, res) => {
//   try {
//     const {
//       userId,
//       name,
//       description = "",
//       category = 1,
//       license = 1,
//       language = "en",
//       privacy = 1,
//       tags = "",
//     } = req.body;
//     const videoFile = req.file;

//     console.log("userId :", userId);
//     console.log("name :", name);
//     console.log("videoFile :", videoFile);

//     // Validate required fields
//     if (!userId || !name || !videoFile) {
//       return res.status(400).json({
//         success: false,
//         code: "MISSING_FIELDS",
//         message: "User ID, video name, and video file are required",
//       });
//     }

//     // Get PeerTube account details
//     const peertubeAccount = await Peertube.findOne({ userId });
//     console.log(
//       "🚀 ~ uploadVideoToPeerTube ~ peertubeAccount:",
//       peertubeAccount
//     );

//     if (!peertubeAccount || !peertubeAccount.peertubeChannelId) {
//       return res.status(404).json({
//         success: false,
//         code: "PEERTUBE_ACCOUNT_NOT_FOUND",
//         message: "No PeerTube account or channel linked to this user",
//       });
//     }

//     const token = await getAccessToken();

//     // Prepare form data with all required fields
//     const formData = new FormData();
//     formData.append("name", name);
//     formData.append("description", description);
//     formData.append("channelId", peertubeAccount.peertubeChannelId); // Must be included
//     formData.append("category", category);
//     formData.append("license", license);
//     formData.append("language", language);
//     formData.append("privacy", privacy);

//     // Handle tags (can be string or array)
//     if (tags) {
//       const tagsArray = typeof tags === "string" ? tags.split(",") : tags;
//       tagsArray.forEach((tag) => formData.append("tags[]", tag.trim()));
//     }

//     // Append video file with correct field name
//     formData.append("videofile", fs.createReadStream(videoFile.path), {
//       filename: videoFile.originalname,
//       contentType: videoFile.mimetype,
//       knownLength: fs.statSync(videoFile.path).size,
//     });

//     const headers = {
//       ...formData.getHeaders(),
//       Authorization: `Bearer ${token}`,
//     };

//     // Upload with extended timeout
//     const uploadResponse = await axios.post(
//       `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/upload`,
//       formData,
//       {
//         headers,
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//         timeout: 30 * 60 * 1000,
//       }
//     );

//     // Clean up
//     fs.unlinkSync(videoFile.path);

//     return res.status(201).json({
//       success: true,
//       data: uploadResponse.data,
//       message: "Video uploaded successfully",
//     });
//   } catch (error) {
//     console.error("Video upload error:", error.response?.data || error.message);

//     // Clean up file if exists
//     if (req.file?.path) {
//       try {
//         fs.unlinkSync(req.file.path);
//       } catch (cleanupError) {
//         console.error("Failed to clean up video file:", cleanupError);
//       }
//     }

//     // Handle specific API errors
//     if (error.response) {
//       const { status, data } = error.response;
//       return res.status(status).json({
//         success: false,
//         code: data.code || "PEERTUBE_API_ERROR",
//         message: data.message || "Video upload failed",
//         details: data.detail || data["invalid-params"] || "Unknown API error",
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       code: "INTERNAL_ERROR",
//       message: "Video upload failed",
//       details: error.message,
//     });
//   }
// });

//* Get video details
const getVideoDetails = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_VIDEO_ID",
        message: "Video ID is required",
      });
    }

    const token = await getAccessToken();

    const response = await axios.get(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${videoId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.status(200).json({
      success: true,
      data: response.data,
      message: "Video details retrieved successfully",
    });
  } catch (error) {
    console.error("Get video error:", error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        code: "VIDEO_NOT_FOUND",
        message: "Video not found",
      });
    }

    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Failed to retrieve video details",
    });
  }
});

//* Delete video
const deleteVideo = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Video ID is required",
      });
    }

    const token = await getAccessToken();

    await axios.delete(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/${videoId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    console.error("Delete video error:", error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        code: "VIDEO_NOT_FOUND",
        message: "Video not found",
      });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You don't have permission to delete this video",
      });
    }

    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Failed to delete video",
    });
  }
});

// & peertube video test controllers ---------------------------------

// Configuration
const MAX_USER_VIDEOS = 75;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for large files

// * upload single video to PeerTube
const uploadVideoToPeerTube = asyncHandler(async (req, res) => {
  try {
    const { userId, name, description = "", privacy = "1" } = req.body;
    const videoFile = req.file;

    // Validate
    if (!userId || !name || !videoFile) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "User ID, video name, and video file are required",
      });
    }

    // Check video quota
    const videoCount = await Video.countDocuments({ userId });
    if (videoCount >= MAX_USER_VIDEOS) {
      return res.status(400).json({
        success: false,
        code: "QUOTA_EXCEEDED",
        message: `Maximum of ${MAX_USER_VIDEOS} videos reached`,
      });
    }

    // Get PeerTube account
    const peertubeAccount = await Peertube.findOne({ userId });
    if (!peertubeAccount?.peertubeChannelId) {
      return res.status(404).json({
        success: false,
        code: "PEERTUBE_ACCOUNT_NOT_FOUND",
        message: "No PeerTube channel linked to this user",
      });
    }

    // Prepare upload
    const token = await getAccessToken();
    const formData = new FormData();

    // Required fields
    formData.append("name", name);
    formData.append("channelId", peertubeAccount.peertubeChannelId.toString());
    formData.append("description", description);
    formData.append("privacy", privacy);
    formData.append("nsfw", "false");
    formData.append("commentsEnabled", "true");
    formData.append("downloadEnabled", "true");

    // Optional fields with defaults
    formData.append("category", req.body.category || "1");
    formData.append("license", req.body.license || "1");
    formData.append("language", req.body.language || "en");

    // Handle tags
    if (req.body.tags) {
      const tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : req.body.tags.split(",");
      tags.forEach((tag) => formData.append("tags[]", tag.trim()));
    }

    // Stream the file in chunks for better memory management
    const fileStream = fs.createReadStream(videoFile.path, {
      highWaterMark: CHUNK_SIZE,
    });
    formData.append("videofile", fileStream, {
      filename: videoFile.originalname,
      contentType: videoFile.mimetype,
      knownLength: fs.statSync(videoFile.path).size,
    });

    // Upload with progress tracking
    const uploadResponse = await axios.post(
      `${process.env.PEERTUBE_INSTANCE_URL}/api/v1/videos/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30 * 60 * 1000, // 30 minutes timeout
      }
    );

    // Save video metadata
    const videoRecord = await Video.create({
      userId,
      peertubeVideoId: uploadResponse.data.video.id,
      peertubeChannelId: peertubeAccount.peertubeChannelId,
      title: name,
      description,
      filePath: uploadResponse.data.video.url,
      duration: uploadResponse.data.video.duration,
      thumbnailPath: uploadResponse.data.video.thumbnailPath,
      privacy,
      category: req.body.category || 1,
      license: req.body.license || 1,
      tags: req.body.tags ? req.body.tags.split(",").map((t) => t.trim()) : [],
      uploadStatus: "published",
      embedIframeUrl: `${process.env.PEERTUBE_INSTANCE_URL || "https://video.visiononline.games"}/videos/embed/${uploadResponse.data.video.uuid}`,
    });

    // Clean up
    fs.unlinkSync(videoFile.path);

    return res.status(201).json({
      success: true,
      data: {
        video: videoRecord,
        remainingQuota: MAX_USER_VIDEOS - (videoCount + 1),
      },
      message: "Video uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error.response?.data || error.message);

    // Clean up file if exists
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }
    }

    // Handle specific errors
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        code: error.response.data?.code || "PEERTUBE_API_ERROR",
        message: error.response.data?.message || "Upload failed",
        details: error.response.data,
      });
    }

    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

//* For multiple uploads
const uploadMultipleVideos = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;
    const files = req.files;

    if (!userId || !files?.length) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "User ID and video files are required",
      });
    }

    // Process uploads sequentially
    const results = [];
    for (const file of files) {
      // Create a mock request object for each file
      const mockReq = {
        body: req.body,
        file,
      };

      // Call the uploadVideoToPeerTube function directly and capture its result
      try {
        // Directly call the uploadVideoToPeerTube function and simulate the res object
        const uploadResult = await uploadVideoToPeerTube(mockReq, {
          status: (code) => ({
            json: (data) => ({ ...data, statusCode: code }),
          }),
        });
        results.push(uploadResult);
      } catch (error) {
        results.push({
          success: false,
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    return res.status(207).json({
      // 207 Multi-Status
      success: true,
      results,
      message: "Batch upload completed",
    });
  } catch (error) {
    console.error("Batch upload error:", error);
    return res.status(500).json({
      success: false,
      code: "BATCH_UPLOAD_ERROR",
      message: error.message,
    });
  }
});

// &---------------------------------------------------------------------

export {
  createPeerTubeAccount,
  createPeerTubeUser,
  deletePeerTubeUser,
  getPeerTubeUser,
  updatePeerTubeUser,
  uploadVideoToPeerTube,
  uploadMultipleVideos,
  getVideoDetails,
  deleteVideo,
};
