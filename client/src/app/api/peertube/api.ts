import { ApiResponse } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Create a new season folder
export const createSeasonFolder = async (
  name: string,
  userId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/seasons/create-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, userId }),
      credentials: "include",
    });
    if (!response.ok)
      throw new Error(
        (await response.json()).message || "Create season failed"
      );
    return await response.json();
  } catch (error) {
    console.error("Create season error:", error);
    throw error;
  }
};

// Get all seasons for a user
export const getSeasons = async (userId: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/get-seasons/${userId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Get seasons failed");
    return await response.json();
  } catch (error) {
    console.error("Get seasons error:", error);
    throw error;
  }
};

// Rename a season folder
export const renameSeasonFolder = async (
  seasonId: string,
  name: string,
  userId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/rename-folder/${seasonId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, userId }),
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).message || "Rename season failed"
      );
    return await response.json();
  } catch (error) {
    console.error("Rename season error:", error);
    throw error;
  }
};

// Delete a season folder
export const deleteSeasonFolder = async (
  seasonId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/delete-folder/${seasonId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).message || "Delete season failed"
      );
    return await response.json();
  } catch (error) {
    console.error("Delete season error:", error);
    throw error;
  }
};

// Add a game to a season
export const addGameToSeason = async (
  seasonId: string,
  name: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/add-game/${seasonId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Add game failed");
    return await response.json();
  } catch (error) {
    console.error("Add game error:", error);
    throw error;
  }
};

// Get all games for a season
export const getGamesForSeason = async (
  seasonId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/get-games/${seasonId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Get games failed");
    return await response.json();
  } catch (error) {
    console.error("Get games error:", error);
    throw error;
  }
};

// Rename a game
export const renameGame = async (
  gameId: string,
  name: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/rename-game/${gameId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Rename game failed");
    return await response.json();
  } catch (error) {
    console.error("Rename game error:", error);
    throw error;
  }
};

// Delete a game
export const deleteGame = async (gameId: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/delete-game/${gameId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Delete game failed");
    return await response.json();
  } catch (error) {
    console.error("Delete game error:", error);
    throw error;
  }
};

// Upload a single video to a game
export const uploadVideoToGame = async (
  gameId: string,
  name: string,
  description: string,
  file: File,
  mute: boolean
): Promise<ApiResponse> => {
  const formData = new FormData();
  formData.append("videoFile", file);
  formData.append("name", name);
  formData.append("description", description);
  formData.append("mute", String(mute));
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/upload-video/${gameId}`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Upload video failed");
    return await response.json();
  } catch (error) {
    console.error("Upload video error:", error);
    throw error;
  }
};

// update the video
export const updateVideoFile = async (
  videoId: string,
  videoDuration: string,
  file: File
): Promise<ApiResponse> => {
  const formData = new FormData();
  formData.append("videoFile", file);
  formData.append("duration", videoDuration);
  try {
    console.log(
      "🚀 ~ updateVideoFile ~ videoDuration:",
      videoDuration || "no duration"
    );
    const response = await fetch(
      `${API_BASE_URL}/seasons/update-video/${videoId}`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Video update failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Update video error:", error);
    throw error;
  }
};

// Upload multiple videos to a game (batch)
export const uploadMultipleVideosToGame = async (
  gameId: string,
  files: FileList
): Promise<ApiResponse> => {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("videoFiles", files[i]);
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/upload/batch/${gameId}`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Batch upload failed");
    return await response.json();
  } catch (error) {
    console.error("Batch upload error:", error);
    throw error;
  }
};

// Get all videos for a game
export const getVideosForGame = async (
  gameId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/get-videos/${gameId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Get videos failed");
    return await response.json();
  } catch (error) {
    console.error("Get videos error:", error);
    throw error;
  }
};

// Get game details with season info and videos
export const getGameDetails = async (gameId: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/get-game-details/${gameId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).message || "Get game details failed"
      );
    return await response.json();
  } catch (error) {
    console.error("Get game details error:", error);
    throw error;
  }
};

// Get PeerTube video details for a video
export const getVideoDetails = async (
  videoId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/get-video-details/${videoId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error(
        (await response.json()).message || "Get video details failed"
      );
    return await response.json();
  } catch (error) {
    console.error("Get video details error:", error);
    throw error;
  }
};
// Get PeerTube video details for a video
export const deleteVideo = async (videoId: string): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/delete-video/${videoId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Delete video failed");
    return await response.json();
  } catch (error) {
    console.error("Delete video error:", error);
    throw error;
  }
};

// Rename a video
export const renameVideo = async (
  videoId: string,
  title: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/rename-video/${videoId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Rename video failed");
    return await response.json();
  } catch (error) {
    console.error("Rename video error:", error);
    throw error;
  }
};

// Move a video to a different game
export const moveVideoToGame = async (
  videoId: string,
  targetGameId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/move-video/${videoId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetGameId }),
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Move video failed");
    return await response.json();
  } catch (error) {
    console.error("Move video error:", error);
    throw error;
  }
};

// Move a game to a different season
export const moveGameToSeason = async (
  gameId: string,
  targetSeasonId: string
): Promise<ApiResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/seasons/move-game/${gameId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSeasonId }),
        credentials: "include",
      }
    );
    if (!response.ok)
      throw new Error((await response.json()).message || "Move game failed");
    return await response.json();
  } catch (error) {
    console.error("Move game error:", error);
    throw error;
  }
};
