"use client";

import {
  addGameToSeason,
  createSeasonFolder,
  deleteGame,
  deleteSeasonFolder,
  deleteVideo,
  getGamesForSeason,
  getSeasons,
  getVideoDetails,
  getVideosForGame,
  renameGame,
  renameSeasonFolder,
  updateVideoFile,
  uploadVideoToGame,
} from "@/app/api/peertube/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleX,
  Edit,
  MenuIcon,
  PlusIcon,
  Share2,
  Trash2,
  Undo,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { toast } from "sonner";
import Loading from "../shared/loading";
import { Checkbox } from "../ui/checkbox";
import ShareVideoModal from "./ShareVideoModal";
import TrimSliderWithThumbnails from "./TrimSliderWithThumbnails";
import { LibrarySidebar } from "./LibrarySidebar";

type Video = {
  description: string;
  peertubeVideoId: string;
  uploadStatus: string;
  userId: string;
  _id?: string;
  title: string;
  tags: string[];
  category: number;
  license: number;
  privacy: number;
  peertubeChannelId: number;
  thumbnailPath?: string;
  videoShareLink?: string;
  videoChannel?: string;
  duration?: number;
  name?: string;
  videoThumbnail?: string;
  videoDuration?: string; // Added to fix compile error
};

type Game = {
  id: string;
  name: string;
  videos: Video[];
  open: boolean;
  selected?: boolean;
};

type Season = {
  id: string;
  name: string;
  games: Game[];
  open: boolean;
};

export function VideoPageMain() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [librarySeasons, setLibrarySeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  type VideoDetails = {
    name?: string;
    title?: string;
    duration?: number;
    muteVideo?: boolean;
    category?: { label?: string };
    thumbnailPath?: string;
    streamingPlaylists?: { files: { fileUrl: string }[] }[];
    [key: string]: unknown; // Add more fields as needed
  };

  // Add this state to VideoPageMain
  const [trimmedVideo, setTrimmedVideo] = useState<{
    blob: Blob | null;
    start: number;
    end: number;
  }>({ blob: null, start: 0, end: 0 });
  console.log("🚀 ~ VideoPageMain ~ trimmedVideo:", trimmedVideo);

  const [selectedVideoDetails, setSelectedVideoDetails] =
    useState<VideoDetails | null>(null);
  const [libraryVideos, setLibraryVideos] = useState<Video[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  console.log("🚀 ~ VideoPageMain ~ currentPlaybackTime:", currentPlaybackTime);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const [renamingItem, setRenamingItem] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);
  const [fetchingVideos, setFetchingVideos] = useState(false);
  const [fetchingVideoDetails, setFetchingVideoDetails] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState("");

  const [uploadConfirmation, setUploadConfirmation] = useState<{
    open: boolean;
    files: File[];
    muteMap: { [filename: string]: boolean };
  }>({ open: false, files: [], muteMap: {} });

  // Add state to track which video is being deleted
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Hls.js instance ref
  const hlsInstance = useRef<Hls | null>(null);
  // Ref to track the original upload target for conditional refresh
  const uploadingGameIdRef = useRef<string | null>(null);
  const { refreshToken, user, logout } = useAuth();

  // Helper function to clean up video playback state
  const cleanupVideoPlayback = (clearSelections = true) => {
    if (clearSelections) {
      setSelectedSeasonId(null);
      setSelectedGameId(null);
      setLibraryVideos([]);
    }
    setSelectedVideo(null);
    setSelectedVideoDetails(null);
    setVideoThumbnail("");
    setCurrentPlaybackTime(0);

    // Stop video playback
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (hlsInstance.current) {
      hlsInstance.current.destroy();
      hlsInstance.current = null;
    }
  };

  // Helper function to find next available video in the same game
  const findNextVideo = (currentVideoId: string, gameVideos: Video[]) => {
    const currentIndex = gameVideos.findIndex(
      (video) => video._id === currentVideoId
    );
    if (currentIndex === -1) return null;

    // Try to find next video
    for (let i = currentIndex + 1; i < gameVideos.length; i++) {
      if (gameVideos[i]._id !== currentVideoId) {
        return gameVideos[i];
      }
    }

    // If no next video, try to find previous video
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (gameVideos[i]._id !== currentVideoId) {
        return gameVideos[i];
      }
    }

    return null;
  };

  // Helper function to find next available game in the same season
  const findNextGame = (currentGameId: string, seasonGames: Game[]) => {
    const currentIndex = seasonGames.findIndex(
      (game) => game.id === currentGameId
    );
    if (currentIndex === -1) return null;

    // Try to find next game
    for (let i = currentIndex + 1; i < seasonGames.length; i++) {
      if (seasonGames[i].id !== currentGameId) {
        return seasonGames[i];
      }
    }

    // If no next game, try to find previous game
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (seasonGames[i].id !== currentGameId) {
        return seasonGames[i];
      }
    }

    return null;
  };

  // Helper function to find next available season
  const findNextSeason = (currentSeasonId: string, allSeasons: Season[]) => {
    const currentIndex = allSeasons.findIndex(
      (season) => season.id === currentSeasonId
    );
    if (currentIndex === -1) return null;

    // Try to find next season
    for (let i = currentIndex + 1; i < allSeasons.length; i++) {
      if (allSeasons[i].id !== currentSeasonId) {
        return allSeasons[i];
      }
    }

    // If no next season, try to find previous season
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (allSeasons[i].id !== currentSeasonId) {
        return allSeasons[i];
      }
    }

    return null;
  };

  // Helper function to navigate to next video
  const navigateToNextVideo = async (nextVideo: Video) => {
    setSelectedVideo(nextVideo);
    setSelectedVideoDetails(null);
    setVideoThumbnail("");
    setCurrentPlaybackTime(0);

    // Stop current playback
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (hlsInstance.current) {
      hlsInstance.current.destroy();
      hlsInstance.current = null;
    }

    // Fetch video details for the new video
    if (nextVideo._id) {
      try {
        await fetchVideoDetails(nextVideo._id);
      } catch (error) {
        console.error("Error fetching next video details:", error);
      }
    }
  };

  // Helper function to navigate to next game
  const navigateToNextGame = async (nextGame: Game, seasonId: string) => {
    setSelectedGameId(nextGame.id);
    setLibraryVideos([]);
    setSelectedVideo(null);
    setSelectedVideoDetails(null);
    setVideoThumbnail("");
    setCurrentPlaybackTime(0);

    // Stop current playback
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (hlsInstance.current) {
      hlsInstance.current.destroy();
      hlsInstance.current = null;
    }

    // Fetch videos for the new game
    try {
      await handleFetchGamesVideos(seasonId, nextGame.id);
    } catch (error) {
      console.error("Error fetching next game videos:", error);
    }
  };

  // Helper function to navigate to next season
  const navigateToNextSeason = async (nextSeason: Season) => {
    setSelectedSeasonId(nextSeason.id);
    setSelectedGameId(null);
    setLibraryVideos([]);
    setSelectedVideo(null);
    setSelectedVideoDetails(null);
    setVideoThumbnail("");
    setCurrentPlaybackTime(0);

    // Stop current playback
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (hlsInstance.current) {
      hlsInstance.current.destroy();
      hlsInstance.current = null;
    }

    // If the next season has games, navigate to the first game
    if (nextSeason.games.length > 0) {
      const firstGame = nextSeason.games[0];
      await navigateToNextGame(firstGame, nextSeason.id);
    }
  };

  // GET VIDEO DETAILS

  // Polling logic for video readiness
  const pollVideoReady = async (
    videoId: string,
    maxAttempts = 15,
    interval = 3000,
    seekTime?: number // Add optional seekTime parameter
  ) => {
    let attempts = 0;
    setFetchingVideoDetails(true);
    while (attempts < maxAttempts) {
      try {
        const res = await getVideoDetails(videoId);
        if (res.success && res.data) {
          const videoDetails = res.data as VideoDetails;
          setSelectedVideoDetails(videoDetails);
          setVideoThumbnail(
            videoDetails.thumbnailPath
              ? `${process.env.PEERTUBE_VIDEO_URL}${videoDetails.thumbnailPath}`
              : ""
          );

          if (
            videoDetails.streamingPlaylists &&
            videoDetails.streamingPlaylists.length > 0
          ) {
            setFetchingVideoDetails(false);
            // If seekTime was provided, restore playback position
            if (seekTime !== undefined && videoRef.current) {
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = seekTime;
                }
              }, 500);
            }
            return;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    setFetchingVideoDetails(false);
    toast.error("Video is still processing. Please try again later.");
  };

  // Wrapper to fetch video details, with polling if not ready
  const fetchVideoDetails = async (videoId: string) => {
    setFetchingVideoDetails(true);
    try {
      const res = await getVideoDetails(videoId);
      if (res.success && res.data) {
        const videoDetails = res.data as VideoDetails;
        setSelectedVideoDetails(videoDetails);
        setVideoThumbnail(
          videoDetails.thumbnailPath
            ? `${
                process.env.PEERTUBE_VIDEO_URL ||
                "https://video.visiononline.games"
              }${videoDetails.thumbnailPath}`
            : ""
        );
        if (
          !videoDetails.streamingPlaylists ||
          videoDetails.streamingPlaylists.length === 0
        ) {
          // Start polling if not ready
          await pollVideoReady(videoId);
        } else {
          setFetchingVideoDetails(false);
        }
      } else {
        setSelectedVideoDetails(null);
        setFetchingVideoDetails(false);
      }
    } catch (err) {
      console.log("🚀 ~ fetchVideoDetails ~ err:", err);
      setSelectedVideoDetails(null);
      setFetchingVideoDetails(false);
    }
  };

  // Load first video of first game in first season by default
  useEffect(() => {
    if (
      seasons.length > 0 &&
      !selectedSeasonId &&
      !selectedGameId &&
      !selectedVideo
    ) {
      const firstSeason = seasons[0];
      setSelectedSeasonId(firstSeason.id);

      if (firstSeason.games.length > 0) {
        const firstGame = firstSeason.games[0];
        setSelectedGameId(firstGame.id);

        if (firstGame.videos.length > 0) {
          const firstVideo = firstGame.videos[0];
          setSelectedVideo(firstVideo);
          fetchVideoDetails(firstVideo._id || "");
        }
      }
    }
  }, [seasons, selectedSeasonId, selectedGameId, selectedVideo]);

  useEffect(() => {
    if (selectedVideo && selectedVideo._id) {
      fetchVideoDetails(selectedVideo._id);
    } else {
      setSelectedVideoDetails(null);
    }
  }, [selectedVideo]);

  useEffect(() => {
    if (user?._id) {
      fetchSeasons();
    }
  }, [user]);

  const fetchSeasons = async () => {
    if (!user?._id) return;

    try {
      setLoading(true);
      const res = await getSeasons(user._id);
      if (res.success && Array.isArray(res.data)) {
        const seasonsWithGames = await Promise.all(
          res.data.map(async (season: { _id: string; name: string }) => {
            const gamesRes = await getGamesForSeason(season._id);
            const gamesWithVideos = await Promise.all(
              gamesRes.success && Array.isArray(gamesRes.data)
                ? gamesRes.data.map(
                    async (game: { _id: string; name: string }) => {
                      const videosRes = await getVideosForGame(game._id);
                      return {
                        id: game._id,
                        name: game.name,
                        videos:
                          videosRes.success && Array.isArray(videosRes.data)
                            ? videosRes.data
                            : [],
                        open: false,
                      };
                    }
                  )
                : []
            );
            return {
              id: season._id,
              name: season.name,
              open: false,
              games: gamesWithVideos,
            };
          })
        );
        console.log("Setting seasons data:", seasonsWithGames);
        setSeasons(seasonsWithGames);
        setLibrarySeasons(seasonsWithGames);
      }
    } catch (err) {
      console.error("Error fetching seasons:", err);
      toast.error("Failed to load seasons");
    } finally {
      setLoading(false);
    }
  };

  const toggleSeason = (seasonId: string) => {
    setSeasons(
      seasons.map((season) =>
        season.id === seasonId ? { ...season, open: !season.open } : season
      )
    );
  };

  const addSeason = async () => {
    if (!user || !user._id) {
      toast.error("User not found. Please login.");
      return;
    }
    try {
      // setSeasonLoading(true);

      const res = await createSeasonFolder("Season", user._id);
      if (res.success && res.data) {
        const newSeason: Season = {
          id: (res.data as { _id: string; name?: string })._id,
          name: (res.data as { _id: string; name?: string }).name || "Season",
          open: true,
          games: [],
        };
        setSeasons([...seasons, newSeason]);
      } else {
        toast.error(res.message || "Failed to create season");
      }
    } catch (err) {
      toast.error("Error creating season: " + err);
    } finally {
      setSeasonLoading(false);
    }
  };

  const addGame = async () => {
    if (!selectedSeasonId) {
      toast.error("Please select a season first");
      return;
    }

    try {
      // setSeasonLoading(true);

      const res = await addGameToSeason(selectedSeasonId, "Game");
      if (res.success && res.data) {
        const newGame: Game = {
          id: (res.data as { _id: string; name?: string })._id,
          name: (res.data as { _id: string; name?: string }).name || "Game",
          open: true,
          videos: [],
        };
        setSeasons(
          seasons.map((s) =>
            s.id === selectedSeasonId
              ? { ...s, games: [...s.games, newGame] }
              : s
          )
        );
      } else {
        toast.error(res.message || "Failed to create game");
      }
    } catch (err) {
      toast.error("Error creating game: " + err);
    } finally {
      setSeasonLoading(false);
    }
  };

  const startRenaming = (
    type: "season" | "game" | "video",
    id: string,
    name: string
  ) => {
    setRenamingItem({ type, id, name });
  };

  const saveRenaming = async () => {
    if (!renamingItem || !user?._id) return;

    const { type, id, name } = renamingItem;
    if (!name.trim()) {
      setRenamingItem(null);
      return;
    }

    try {
      // setSeasonLoading(true);

      if (type === "season") {
        const res = await renameSeasonFolder(id, name, user._id);
        if (res.success) {
          setSeasons(
            seasons.map((season) =>
              season.id === id ? { ...season, name } : season
            )
          );
        } else {
          toast.error(res.message || "Failed to rename season");
        }
      } else if (type === "game") {
        const res = await renameGame(id, name);
        if (res.success) {
          setSeasons(
            seasons.map((season) => ({
              ...season,
              games: season.games.map((game) =>
                game.id === id ? { ...game, name } : game
              ),
            }))
          );
        } else {
          toast.error(res.message || "Failed to rename game");
        }
      }
      setRenamingItem(null);
    } catch (err) {
      toast.error("Rename error: " + err);
    } finally {
      setSeasonLoading(false);
    }
  };

  // delete season

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteSeason = async (seasonId: string) => {
    try {
      setDeleteLoading(true);

      const res = await deleteSeasonFolder(seasonId);
      if (res.success) {
        // Try to navigate to next season if current season was selected
        if (selectedSeasonId === seasonId) {
          const nextSeason = findNextSeason(seasonId, seasons);
          if (nextSeason) {
            await navigateToNextSeason(nextSeason);
            toast.success(
              "Season deleted successfully. Navigated to next season."
            );
          } else {
            cleanupVideoPlayback(true); // Clear all if no next season
            toast.success(
              "Season deleted successfully. No more seasons available."
            );
          }
        } else {
          toast.success("Season deleted successfully");
        }
      } else {
        toast.error(res.message || "Failed to delete season");
      }
    } catch (err) {
      toast.error("Delete season error: " + err);
    } finally {
      setDeleteLoading(false);
      setSeasonLoading(false);
      setShowConfirmDeleteModal(false);
    }
  };

  // ******************
  // State for delete confirmation modal
  const [pendingDelete, setPendingDelete] = useState<{
    seasonId: string;
    gameId: string;
  } | null>(null);

  // Show confirmation modal before deleting a game
  const deleteGameFromSeason = (seasonId: string, gameId: string) => {
    setPendingDelete({ seasonId, gameId });
  };

  // Actually delete the game after confirmation
  const confirmDeleteGame = async () => {
    if (!pendingDelete) return;
    const { seasonId, gameId } = pendingDelete;

    try {
      setSeasonLoading(true);
      const res = await deleteGame(gameId);
      if (res.success) {
        // Update the seasons state
        const updatedSeasons = seasons.map((season) =>
          season.id === seasonId
            ? {
                ...season,
                games: season.games.filter((game) => game.id !== gameId),
              }
            : season
        );
        setSeasons(updatedSeasons);

        // Try to navigate to next game if current game was selected
        if (selectedGameId === gameId) {
          const currentSeason = updatedSeasons.find((s) => s.id === seasonId);
          if (currentSeason) {
            const nextGame = findNextGame(gameId, currentSeason.games);
            if (nextGame) {
              await navigateToNextGame(nextGame, seasonId);
              toast.success(
                "Game deleted successfully. Navigated to next game."
              );
            } else {
              cleanupVideoPlayback(true); // Clear all if no next game
              toast.success(
                "Game deleted successfully. No more games in this season."
              );
            }
          } else {
            cleanupVideoPlayback(true);
            toast.success("Game deleted successfully");
          }
        } else {
          toast.success("Game deleted successfully");
        }
      } else {
        toast.error(res.message || "Failed to delete game");
      }
    } catch (err) {
      toast.error("Delete game error: " + err);
    } finally {
      setDeleteLoading(false);
      setSeasonLoading(false);
      setPendingDelete(null);
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const selectVideo = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleDeleteVideo = async (video: Video) => {
    console.log("🚀 ~ handleDeleteVideo ~ video:", video);
    if (!video._id) {
      toast.error("Cannot delete video: Missing video ID");
      return;
    }

    try {
      setDeletingVideoId(video._id); // Set the video being deleted
      // toast.info("Deleting video... Please wait.");
      await deleteVideo(video._id);
      toast.success("Video deleted successfully");

      // Remove the video from the library
      setLibraryVideos((prev) => prev.filter((v) => v._id !== video._id));

      // If the deleted video was selected, try to navigate to next video
      if (selectedVideo?._id === video._id) {
        const remainingVideos = libraryVideos.filter(
          (v) => v._id !== video._id
        );
        const nextVideo = findNextVideo(video._id, remainingVideos);

        if (nextVideo) {
          await navigateToNextVideo(nextVideo);
          toast.success("Video deleted successfully. Navigated to next video.");
        } else {
          cleanupVideoPlayback(false); // Don't clear season/game selections, just video
          toast.success(
            "Video deleted successfully. No more videos in this game."
          );
        }
      }

      // Update the seasons state to reflect the deletion
      setSeasons((prevSeasons) =>
        prevSeasons.map((season) => ({
          ...season,
          games: season.games.map((game) => ({
            ...game,
            videos: game.videos.filter((v) => v._id !== video._id),
          })),
        }))
      );
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    } finally {
      setDeletingVideoId(null); // Reset the deletingVideoId
    }
  };

  // FETCHING VIDEOS
  // Modified handleFetchGamesVideos - no upload restrictions
  const handleFetchGamesVideos = async (
    seasonId: string,
    gameId: string,
    selectVideoId?: string
  ) => {
    // Clear videos first to prevent showing old videos while loading
    setLibraryVideos([]);
    setSelectedVideo(null);

    setSelectedSeasonId(seasonId);
    setSelectedGameId(gameId);

    try {
      setFetchingVideos(true);
      const res = await getVideosForGame(gameId);
      if (res.success) {
        const videos = Array.isArray(res.data) ? res.data : [];
        setLibraryVideos(videos);

        // Update only the specific game's videos in the state
        setSeasons((prevSeasons) =>
          prevSeasons.map((season) => {
            if (season.id === seasonId) {
              return {
                ...season,
                games: season.games.map((game) => {
                  if (game.id === gameId) {
                    return {
                      ...game,
                      videos: videos,
                    };
                  }
                  return game;
                }),
              };
            }
            return season;
          })
        );

        // Select the specified video if provided, otherwise select the first video
        if (selectVideoId) {
          const targetVideo = videos.find(
            (video) => video._id === selectVideoId
          );
          if (targetVideo) {
            setSelectedVideo(targetVideo);
          } else if (videos.length > 0) {
            setSelectedVideo(videos[0]);
          }
        } else if (videos.length > 0) {
          setSelectedVideo(videos[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching game videos:", err);
      setLibraryVideos([]);
      setSelectedVideo(null);
    } finally {
      setFetchingVideos(false);
    }
  };

  // Call handleFetchGamesVideos on first load with first season/game
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId && !selectedGameId) {
      const firstSeason = seasons[0];
      if (firstSeason.games.length > 0) {
        const firstGame = firstSeason.games[0];
        handleFetchGamesVideos(firstSeason.id, firstGame.id);
      }
    }
  }, [seasons, selectedSeasonId, selectedGameId]);

  //* ADD NEW VIDEO
  // --------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArr = Array.from(e.target.files);
      const validTypes = [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
        "video/webm",
      ];
      const filtered = filesArr.filter((file) => {
        if (!validTypes.includes(file.type)) {
          toast.error(
            `Invalid file type for ${file.name} (MP4, MOV, AVI, MKV, WEBM required)`
          );
          return false;
        }
        return true;
      });
      if (filtered.length > 0) {
        // Default all to unmuted
        const muteMap: { [filename: string]: boolean } = {};
        filtered.forEach((file) => {
          muteMap[file.name] = false;
        });
        setUploadConfirmation({
          open: true,
          files: filtered,
          muteMap,
        });
      } else {
        // Reset file input if no valid files were selected
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } else {
      // Reset file input if no files were selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Track uploading state for each file
  // const [uploadingFiles] = useState<
  //   {
  //     name: string;
  //     status: "uploading" | "success" | "error";
  //     error?: string;
  //   }[]
  // >([]);

  // Add a state to track active uploads per game
  const [activeUploads, setActiveUploads] = useState<{
    [gameId: string]: {
      files: {
        name: string;
        status: "uploading" | "success" | "error";
        error?: string;
      }[];
    };
  }>({});

  // state to tract uploading gameId
  const [uploadingGameId, setUploadingGameId] = useState<string | null>(null);
  console.log("🚀 ~ VideoPageMain ~ uploadingGameId:", uploadingGameId);

  // Helper function to check if there are any active uploads
  const hasActiveUploads = () => {
    const hasUploads = Object.values(activeUploads).some((gameUploads) =>
      gameUploads.files.some((file) => file.status === "uploading")
    );
    console.log("hasActiveUploads check:", { activeUploads, hasUploads });
    return hasUploads;
  };

  const isTrimming = () => {
    const result = replacingVideo?.status === "uploading" || localTrimming;
    console.log("isTrimming check:", {
      replacingVideoStatus: replacingVideo?.status,
      localTrimming,
      result,
    });
    return result;
  };

  // Toast ID for upload notification
  const uploadToastId = "upload-notification";

  // 888888888888888888888888****
  const handleUploadConfirmation = async (confirmed: boolean) => {
    setUploadConfirmation({ open: false, files: [], muteMap: {} });

    // Reset file input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!confirmed || !uploadConfirmation.files.length || !selectedGameId)
      return;

    // Store the original upload target in ref for stable comparison
    uploadingGameIdRef.current = selectedGameId;
    setUploadingGameId(selectedGameId);

    // Initialize upload tracking for this game
    setActiveUploads((prev) => ({
      ...prev,
      [selectedGameId]: {
        files: uploadConfirmation.files.map((file) => ({
          name: file.name,
          status: "uploading" as const,
        })),
      },
    }));

    try {
      for (let i = 0; i < uploadConfirmation.files.length; i++) {
        const file = uploadConfirmation.files[i];
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const description = nameWithoutExt || "Uploaded via UI";
        const mute = uploadConfirmation.muteMap[file.name] || false;

        try {
          const res = await uploadVideoToGame(
            selectedGameId,
            nameWithoutExt,
            description,
            file,
            mute
          );

          if (res.success) {
            // Update the upload status silently
            setActiveUploads((prev) => ({
              ...prev,
              [selectedGameId]: {
                files:
                  prev[selectedGameId]?.files.filter(
                    (f) => f.name !== file.name
                  ) || [],
              },
            }));

            // Run condition for each uploaded video - compare with original upload target
            if (selectedGameId === uploadingGameIdRef.current) {
              // toast.success(`Video "${file.name}" uploaded successfully!`);

              // Silently refresh the game's videos in the background
              const videosRes = await getVideosForGame(selectedGameId);
              if (videosRes.success) {
                const updatedVideos = Array.isArray(videosRes.data)
                  ? videosRes.data
                  : [];

                // Update the seasons state without affecting UI
                setSeasons((prevSeasons) =>
                  prevSeasons.map((season) => {
                    if (season.id === selectedSeasonId) {
                      return {
                        ...season,
                        games: season.games.map((game) => {
                          if (game.id === selectedGameId) {
                            return {
                              ...game,
                              videos: updatedVideos,
                            };
                          }
                          return game;
                        }),
                      };
                    }
                    return season;
                  })
                );
                setLibraryVideos(updatedVideos);
              }
            } else {
              toast.success(`Video "${file.name}" uploaded successfully!`);
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`Failed to upload ${file.name}:`, errorMessage);

          // Remove the failed upload from activeUploads immediately
          setActiveUploads((prev) => ({
            ...prev,
            [selectedGameId]: {
              files:
                prev[selectedGameId]?.files.filter(
                  (f) => f.name !== file.name
                ) || [],
            },
          }));

          // Show error toast for the failed upload
          toast.error(`Failed to upload "${file.name}": ${errorMessage}`);
        }
      }
    } finally {
      // Clean up completed uploads immediately
      setActiveUploads((prev) => {
        const newState = { ...prev };
        if (newState[selectedGameId]?.files.length === 0) {
          delete newState[selectedGameId];
        }
        return newState;
      });

      // Clear the upload tracking when all uploads are done
      setTimeout(() => {
        setActiveUploads((prev) => {
          if (Object.keys(prev).length === 0) {
            setUploadingGameId(null);
            uploadingGameIdRef.current = null;
          }
          return prev;
        });
      }, 1000);
    }
  };

  useEffect(() => {
    if (
      selectedVideoDetails &&
      selectedVideoDetails.streamingPlaylists &&
      selectedVideoDetails.streamingPlaylists.length > 0 &&
      videoRef.current
    ) {
      const videoSrc =
        selectedVideoDetails.streamingPlaylists[0].files[0]?.fileUrl;
      if (videoSrc && videoSrc.endsWith(".m3u8")) {
        if (Hls.isSupported()) {
          if (hlsInstance.current) {
            hlsInstance.current.destroy();
          }
          const hls = new Hls();
          hls.loadSource(videoSrc);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.current?.play();
          });
          hlsInstance.current = hls;
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          videoRef.current.src = videoSrc;
        }
      } else if (videoSrc) {
        if (hlsInstance.current) {
          hlsInstance.current.destroy();
          hlsInstance.current = null;
        }
        videoRef.current.src = videoSrc;
      }
      videoRef.current.muted = selectedVideoDetails.muteVideo || false;
    } else {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = "";
      }
    }
    // Cleanup on unmount
    return () => {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
    };
  }, [selectedVideoDetails, hasActiveUploads]);

  // Manage upload notification toast
  useEffect(() => {
    const hasUploads = hasActiveUploads();

    if (hasUploads) {
      // Show persistent toast for uploads
      toast.loading(
        <div className="flex items-center justify-between w-full min-w-[300px]">
          <div className="flex items-center gap-2 flex-1">
            {/* <Loading size={16} /> */}
            <span className="w-full text-center flex justify-center items-center">
              Video upload in progress. Please wait before switching folders or
              seasons.
            </span>
          </div>
          <button
            onClick={() => toast.dismiss(uploadToastId)}
            className="ml-4 text-inherit hover:text-inherit transition-colors cursor-pointer flex-shrink-0"
          >
            ✕
          </button>
        </div>,
        {
          id: uploadToastId,
          duration: Infinity, // Keep until dismissed or uploads complete
        }
      );
    } else {
      // Dismiss toast when no uploads are active
      toast.dismiss(uploadToastId);
    }
  }, [activeUploads]);

  // * show share modal
  const [shareModal, setShareModal] = useState(false);
  const [shareVideoId, setShareVideoId] = useState("");

  const showShareModal = (link: string) => {
    setShareVideoId(link || "");
    setShareModal(true);
  };

  // * trim video
  // Add this state to track the video being replaced
  const [replacingVideo, setReplacingVideo] = useState<{
    videoId: string;
    status: "idle" | "uploading" | "success" | "error";
    error?: string;
  } | null>(null);

  const [localTrimming, setLocalTrimming] = useState(false);

  const [trimPreview, setTrimPreview] = useState<{
    start: number;
    end: number;
    active: boolean;
  }>({ start: 0, end: 0, active: false });

  const duration = trimmedVideo.end - trimmedVideo.start; // 11 - 5 = 6 seconds
  console.log("🚀 ~ VideoPageMain ~ duration:", duration);

  // Add this function to handle the video replacement
  // const handleDragDrop = (
  //   draggedItem: { type: "season" | "game" | "video"; id: string; data: any },
  //   targetType: "season" | "game",
  //   targetId: string
  // ) => {
  //   // Handle local drag and drop operations
  //   if (draggedItem.type === "video" && targetType === "game") {
  //     // Move video to different game
  //     const videoId = draggedItem.id;
  //     const targetGameId = targetId;

  //     // Find the video and remove it from its current location
  //     setSeasons((prevSeasons) => {
  //       const newSeasons = [...prevSeasons];

  //       // Remove video from current game
  //       for (const season of newSeasons) {
  //         for (const game of season.games) {
  //           const videoIndex = game.videos.findIndex((v) => v._id === videoId);
  //           if (videoIndex !== -1) {
  //             const video = game.videos[videoIndex];
  //             game.videos.splice(videoIndex, 1);

  //             // Add video to target game
  //             for (const targetSeason of newSeasons) {
  //               const targetGame = targetSeason.games.find(
  //                 (g) => g.id === targetGameId
  //               );
  //               if (targetGame) {
  //                 targetGame.videos.push(video);
  //                 break;
  //               }
  //             }
  //             break;
  //           }
  //         }
  //       }

  //       return newSeasons;
  //     });
  //   } else if (draggedItem.type === "game" && targetType === "season") {
  //     // Move game to different season
  //     const gameId = draggedItem.id;
  //     const targetSeasonId = targetId;

  //     setSeasons((prevSeasons) => {
  //       const newSeasons = [...prevSeasons];
  //       let gameToMove: Game | null = null;

  //       // Find and remove game from current season
  //       for (const season of newSeasons) {
  //         const gameIndex = season.games.findIndex((g) => g.id === gameId);
  //         if (gameIndex !== -1) {
  //           gameToMove = season.games[gameIndex];
  //           season.games.splice(gameIndex, 1);
  //           break;
  //         }
  //       }

  //       // Add game to target season
  //       if (gameToMove) {
  //         const targetSeason = newSeasons.find((s) => s.id === targetSeasonId);
  //         if (targetSeason) {
  //           targetSeason.games.push(gameToMove);
  //         }
  //       }

  //       return newSeasons;
  //     });
  //   }

  //   console.log(
  //     `Dropped ${draggedItem.type} ${draggedItem.id} into ${targetType} ${targetId}`
  //   );
  // };

  // Separate drag drop handler for library sidebar
  const handleLibraryDragDrop = (
    draggedItem: {
      type: "season" | "game" | "video";
      id: string;
      data: Season | Game | Video | { videos: Video[]; count: number };
    },
    targetType: "season" | "game",
    targetId: string
  ) => {
    // Handle local drag and drop operations for library only
    if (draggedItem.type === "video" && targetType === "game") {
      const targetGameId = targetId;

      // Handle multiple video drag and drop
      if (
        draggedItem.id === "multiple" &&
        "videos" in draggedItem.data &&
        Array.isArray(draggedItem.data.videos)
      ) {
        const videosToMove = draggedItem.data.videos;

        setLibrarySeasons((prevSeasons) => {
          const newSeasons = [...prevSeasons];

          // Remove all selected videos from their current locations
          for (const videoToMove of videosToMove) {
            for (const season of newSeasons) {
              for (const game of season.games) {
                const videoIndex = game.videos.findIndex(
                  (v) => v._id === videoToMove._id
                );
                if (videoIndex !== -1) {
                  game.videos.splice(videoIndex, 1);
                  break;
                }
              }
            }
          }

          // Add all videos to target game
          for (const targetSeason of newSeasons) {
            const targetGame = targetSeason.games.find(
              (g) => g.id === targetGameId
            );
            if (targetGame) {
              targetGame.videos.push(...videosToMove);
              break;
            }
          }

          return newSeasons;
        });
      } else {
        // Handle single video drag and drop
        const videoId = draggedItem.id;

        setLibrarySeasons((prevSeasons) => {
          const newSeasons = [...prevSeasons];

          // Remove video from current game
          for (const season of newSeasons) {
            for (const game of season.games) {
              const videoIndex = game.videos.findIndex(
                (v) => v._id === videoId
              );
              if (videoIndex !== -1) {
                const video = game.videos[videoIndex];
                game.videos.splice(videoIndex, 1);

                // Add video to target game
                for (const targetSeason of newSeasons) {
                  const targetGame = targetSeason.games.find(
                    (g) => g.id === targetGameId
                  );
                  if (targetGame) {
                    targetGame.videos.push(video);
                    break;
                  }
                }
                break;
              }
            }
          }

          return newSeasons;
        });
      }
    } else if (draggedItem.type === "game" && targetType === "season") {
      // Move game to different season
      const gameId = draggedItem.id;
      const targetSeasonId = targetId;

      setLibrarySeasons((prevSeasons) => {
        const newSeasons = [...prevSeasons];
        let gameToMove: Game | null = null;

        // Find and remove game from current season
        for (const season of newSeasons) {
          const gameIndex = season.games.findIndex((g) => g.id === gameId);
          if (gameIndex !== -1) {
            gameToMove = season.games[gameIndex];
            season.games.splice(gameIndex, 1);
            break;
          }
        }

        // Add game to target season
        if (gameToMove) {
          const targetSeason = newSeasons.find((s) => s.id === targetSeasonId);
          if (targetSeason) {
            targetSeason.games.push(gameToMove);
          }
        }

        return newSeasons;
      });
    }

    console.log(
      `Library: Dropped ${draggedItem.type} ${draggedItem.id} into ${targetType} ${targetId}`
    );
  };

  const handleReplaceVideo = async (videoId: string, blob: Blob) => {
    if (!videoId || !blob) return;

    setReplacingVideo({
      videoId,
      status: "uploading",
    });

    try {
      // Convert Blob to File
      const file = new File([blob], `trimmed-${Date.now()}.mp4`, {
        type: "video/mp4",
      });

      // Call the updateVideoFile API
      const response = await updateVideoFile(videoId, duration, file);

      if (response.success) {
        // Refresh the video list and select the same video that was trimmed
        if (selectedSeasonId && selectedGameId) {
          await handleFetchGamesVideos(
            selectedSeasonId,
            selectedGameId,
            videoId
          );
        }

        setReplacingVideo({
          videoId,
          status: "success",
        });

        // Disable edit mode after successful trim
        setEditMode(false);

        // Reset localTrimming state
        setLocalTrimming(false);

        // Reset replacingVideo to null immediately to ensure UI is re-enabled
        setReplacingVideo(null);
        console.log("Reset replacingVideo to null immediately");

        // Check isTrimming status right before showing success toast
        console.log("isTrimming status before success toast:", isTrimming());

        toast.success("Video successfully replaced with trimmed version");
      } else {
        throw new Error(response.message || "Failed to update video");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setReplacingVideo({
        videoId,
        status: "error",
        error: errorMessage,
      });
      toast.error(`Failed to replace video: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="">
        <Loading fullScreen />
      </div>
    );
  }

  return (
    <>
      {/* <div className="flex lg:flex-col flex-row justify-start items-start h-full bg-transparent"> */}
      <div className="flex lg:flex-row flex-col justify-start items-start gap-2 lg:h-full h-auto bg-transparent">
        {/* <div className="w-1/4 h-full border-r p-4"> */}
        <div className="lg:w-1/4 lg:h-full w-full h-auto border-r py-4 px-2 bg-transparent lg:overflow-y-auto">
          <div className="w-full h-auto flex justify-between items-center gap-2 py-4 px-[0%]">
            <Button
              size={"sm"}
              className="text-xs"
              onClick={addSeason}
              disabled={loading || hasActiveUploads() || isTrimming()}
            >
              <PlusIcon /> SEASON
            </Button>
            <Button
              size={"sm"}
              className="text-xs"
              onClick={async () => {
                await addGame();
                // After adding a game, do NOT change selectedGameId or selectedVideo.
                // This keeps the user in the currently selected game.
              }}
              disabled={
                !selectedSeasonId ||
                loading ||
                hasActiveUploads() ||
                isTrimming()
              }
            >
              <PlusIcon /> GAME
            </Button>
            <Button
              size={"sm"}
              variant={
                !selectedGameId || loading || editMode ? "outline" : "default"
              }
              disabled={
                !selectedGameId ||
                loading ||
                editMode ||
                hasActiveUploads() ||
                isTrimming()
              }
              onClick={() => fileInputRef.current?.click()}
              className="disabled:opacity-50 text-xs disabled:cursor-not-allowed"
            >
              UPLOAD
              <Input
                id="videoFiles"
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </Button>
          </div>

          <div className="space-y-4">
            {seasonLoading ? (
              <div className="w-full min-h-[40vh] h-full flex justify-center items-center">
                <Loading size={20} />
              </div>
            ) : (
              <>
                {seasons.map((season) => (
                  <Card
                    key={season.id}
                    className="px-0 py-2 my-1 border border-[#454444]"
                    style={{
                      backgroundColor: "rgb(133, 133, 133)",
                    }}
                  >
                    <CardContent className="px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {/* // In the season selection button: */}
                          <Button
                            variant={
                              selectedSeasonId === season.id
                                ? "secondary"
                                : "ghost"
                            }
                            size="icon"
                            className={`h-6 w-6 hover:bg-transparent border-2 ${
                              selectedSeasonId === season.id
                                ? "border-[#454444] bg-black-100"
                                : "border-transparent"
                            }`}
                            onClick={() => {
                              toggleSeason(season.id);
                              setSelectedSeasonId(season.id);
                            }}
                            disabled={
                              loading || hasActiveUploads() || isTrimming()
                            }
                          >
                            {season.open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          {renamingItem?.type === "season" &&
                          renamingItem.id === season.id ? (
                            <Input
                              autoFocus
                              value={renamingItem.name}
                              onChange={(e) =>
                                setRenamingItem({
                                  ...renamingItem,
                                  name: e.target.value,
                                })
                              }
                              onBlur={saveRenaming}
                              onKeyDown={(e) =>
                                e.key === "Enter" && saveRenaming()
                              }
                              className="h-8"
                              disabled={
                                loading || hasActiveUploads() || isTrimming()
                              }
                            />
                          ) : (
                            <CardTitle
                              className={`text-sm ${
                                hasActiveUploads() || isTrimming()
                                  ? "cursor-not-allowed opacity-50"
                                  : "cursor-pointer"
                              }`}
                              onDoubleClick={() =>
                                !hasActiveUploads() &&
                                !isTrimming() &&
                                startRenaming("season", season.id, season.name)
                              }
                              onClick={() =>
                                !hasActiveUploads() &&
                                !isTrimming() &&
                                setSelectedSeasonId(season.id)
                              }
                            >
                              {season.name}
                            </CardTitle>
                          )}
                        </div>

                        <div className="flex space-x-1 justify-center items-center">
                          <Button
                            size={"icon"}
                            variant={"link"}
                            onClick={() =>
                              showShareModal(
                                `sharedSeason?id=${season.id}` as string
                              )
                            }
                            disabled={hasActiveUploads() || isTrimming()}
                          >
                            <Share2 className="w-8 h-8" />
                          </Button>
                          {editMode && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-transparent hover:bg-transparent"
                                onClick={() => setShowConfirmDeleteModal(true)}
                                disabled={
                                  loading || hasActiveUploads() || isTrimming()
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                              {/* Delete Season Confirmation Modal */}
                              <Dialog
                                open={showConfirmDeleteModal}
                                onOpenChange={(open) => {
                                  if (!open) setShowConfirmDeleteModal(false);
                                }}
                              >
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Season</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to delete this
                                      season? This action cannot be undone.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        setShowConfirmDeleteModal(false)
                                      }
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      disabled={
                                        deleteLoading ||
                                        hasActiveUploads() ||
                                        isTrimming()
                                      }
                                      variant="destructive"
                                      onClick={() => {
                                        deleteSeason(season.id);
                                      }}
                                    >
                                      {deleteLoading ? (
                                        <Loading size={20} />
                                      ) : (
                                        "Delete"
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    {/* games */}
                    {season.open && (
                      <CardContent className="p-0">
                        {season.games.map((game) => (
                          <div
                            key={game.id}
                            className="border-t border-[#454444]"
                          >
                            <div className="flex items-center justify-between w-full py-1 px-3 hover:bg-transparent">
                              <div className="flex items-center space-x-2 flex-1">
                                {/* // In the game selection button: */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 border-2 border-transparent"
                                  style={{
                                    backgroundColor:
                                      selectedGameId === game.id
                                        ? "rgb(133, 133, 133)"
                                        : "transparent",
                                  }}
                                  onClick={() => {
                                    // setLibraryVideos([]); // Clear immediately when switching
                                    // setSelectedVideo(null);
                                    handleFetchGamesVideos(season.id, game.id);
                                  }}
                                  disabled={
                                    fetchingVideos ||
                                    hasActiveUploads() ||
                                    isTrimming()
                                  }
                                >
                                  {fetchingVideos &&
                                  selectedGameId === game.id ? (
                                    <Loading size={20} />
                                  ) : selectedGameId === game.id ? (
                                    <CircleCheck className="h-4 w-4" />
                                  ) : (
                                    <Circle className="h-4 w-4" />
                                  )}
                                </Button>
                                {renamingItem?.type === "game" &&
                                renamingItem.id === game.id ? (
                                  <Input
                                    autoFocus
                                    value={renamingItem.name}
                                    onChange={(e) =>
                                      setRenamingItem({
                                        ...renamingItem,
                                        name: e.target.value,
                                      })
                                    }
                                    onBlur={saveRenaming}
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && saveRenaming()
                                    }
                                    className="h-8"
                                    disabled={
                                      loading ||
                                      hasActiveUploads() ||
                                      isTrimming()
                                    }
                                  />
                                ) : (
                                  <span
                                    className={`text-sm ${
                                      hasActiveUploads() || isTrimming()
                                        ? "cursor-not-allowed opacity-50"
                                        : "cursor-pointer"
                                    }`}
                                    onDoubleClick={() =>
                                      !hasActiveUploads() &&
                                      !isTrimming() &&
                                      startRenaming("game", game.id, game.name)
                                    }
                                    onClick={() =>
                                      !hasActiveUploads() &&
                                      !isTrimming() &&
                                      handleFetchGamesVideos(season.id, game.id)
                                    }
                                    // onClick={() => setSelectedGameId(game.id)}
                                  >
                                    {game.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-nowrap justify-center items-center">
                                <div className="flex flex-nowrap justify-center items-center">
                                  {/* add video button */}
                                  {!editMode && game.id === selectedGameId && (
                                    <div className="flex items-center gap-4">
                                      <Button
                                        size={"sm"}
                                        variant={"outline"}
                                        disabled={
                                          loading ||
                                          hasActiveUploads() ||
                                          isTrimming()
                                        }
                                        onClick={() =>
                                          fileInputRef.current?.click()
                                        }
                                        className="hover:bg-transparent bg-transparent border-[#454444]"
                                      >
                                        <PlusIcon />
                                        <Input
                                          id="videoFiles"
                                          ref={fileInputRef}
                                          type="file"
                                          accept="video/*"
                                          multiple
                                          onChange={handleFileChange}
                                          className="hidden"
                                        />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size={"icon"}
                                  variant={"link"}
                                  onClick={() =>
                                    showShareModal(
                                      `sharedGame?id=${game.id}` as string
                                    )
                                  }
                                  disabled={hasActiveUploads() || isTrimming()}
                                >
                                  <Share2 className="w-8 h-8" />
                                </Button>
                                {editMode && (
                                  <div className="flex space-x-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        deleteGameFromSeason(season.id, game.id)
                                      }
                                      disabled={
                                        loading ||
                                        hasActiveUploads() ||
                                        isTrimming()
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Delete Game Confirmation Modal */}
                              <Dialog
                                open={!!pendingDelete}
                                onOpenChange={(open) => {
                                  if (!open) setPendingDelete(null);
                                }}
                              >
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Game</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to delete this game?
                                      This action cannot be undone.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => setPendingDelete(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      disabled={
                                        deleteLoading ||
                                        hasActiveUploads() ||
                                        isTrimming()
                                      }
                                      variant="destructive"
                                      onClick={confirmDeleteGame}
                                    >
                                      {deleteLoading ? (
                                        <Loading size={20} />
                                      ) : (
                                        "Delete"
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>

        {/* main container for video player */}
        {/* <div className="flex-1 flex flex-col h-full"> */}
        <div className="flex-1 flex flex-col lg:w-flex-1 lg:h-full w-full h-auto">
          <div className="flex-1 p-4 border-b w-full h-auto min-h-[70vh]">
            {fetchingVideoDetails ||
            replacingVideo?.status === "uploading" ||
            (libraryVideos.length === 0 &&
              selectedGameId &&
              activeUploads[selectedGameId]?.files.length > 0) ? (
              <div className="h-full flex flex-col">
                {/* Video Player Skeleton */}
                <div className="bg-gray-200 rounded-lg aspect-video animate-pulse flex flex-col items-center justify-center relative">
                  <div className="w-full h-full bg-gray-300 rounded-lg flex items-center justify-center animate-pulse">
                    <div className="text-center">
                      <div className="w-full h-12 bg-gray-400 rounded mx-auto mb-4 animate-pulse"></div>
                      <div className="h-4 bg-gray-400 rounded w-48 mx-auto mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gray-400 rounded w-32 mx-auto animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedVideo ? (
              <div className="h-auto flex flex-col">
                {/* ---------trim-------------- */}

                <div className="bg-black rounded-lg aspect-video flex flex-col items-center justify-center relative">
                  {selectedVideoDetails ? (
                    <>
                      {selectedVideoDetails.streamingPlaylists &&
                      selectedVideoDetails.streamingPlaylists.length > 0 ? (
                        <>
                          {/* Trim slider with thumbnails below video */}
                          {editMode &&
                            selectedVideoDetails.duration &&
                            selectedVideoDetails.duration > 0 && (
                              <div className="w-full z-50 flex flex-col items-center mt-0 px-0">
                                <TrimSliderWithThumbnails
                                  duration={selectedVideoDetails.duration}
                                  videoUrl={
                                    selectedVideoDetails.streamingPlaylists[0]
                                      .files[0]?.fileUrl
                                  }
                                  videoThumbnail={videoThumbnail}
                                  videoId={selectedVideo?._id}
                                  video={selectedVideo as VideoDetails}
                                  onTrimChange={(start, end) => {
                                    setTrimPreview({
                                      start,
                                      end,
                                      active: true,
                                    });
                                    // Seek the video to the new start time
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = start;
                                    }
                                  }}
                                  onTrimComplete={async (blob, start, end) => {
                                    setTrimmedVideo({ blob, start, end });
                                    setTrimPreview({
                                      start: 0,
                                      end: 0,
                                      active: false,
                                    });
                                    if (selectedVideo?._id) {
                                      await handleReplaceVideo(
                                        selectedVideo._id,
                                        blob
                                      );
                                    }
                                  }}
                                  onTrimStateChange={(isTrimming) => {
                                    console.log(
                                      "onTrimStateChange called with:",
                                      isTrimming
                                    );
                                    setLocalTrimming(isTrimming);
                                    console.log(
                                      "localTrimming state updated to:",
                                      isTrimming
                                    );
                                  }}
                                />
                              </div>
                            )}

                          <video
                            ref={videoRef}
                            controls
                            autoPlay
                            className="w-full h-full rounded-lg"
                            poster={videoThumbnail}
                            onTimeUpdate={(e) => {
                              const currentTime = e.currentTarget.currentTime;
                              setCurrentPlaybackTime(currentTime);

                              // If in trim preview mode and we reach the end, loop back to start
                              if (
                                trimPreview.active &&
                                currentTime >= trimPreview.end
                              ) {
                                e.currentTarget.currentTime = trimPreview.start;
                              }
                            }}
                            onEnded={() => {
                              if (trimPreview.active) {
                                // Loop the trimmed section
                                if (videoRef.current) {
                                  videoRef.current.currentTime =
                                    trimPreview.start;
                                  videoRef.current.play();
                                }
                              } else {
                                // Original behavior - go to next video
                                const currentIdx = libraryVideos.findIndex(
                                  (v) => v._id === selectedVideo?._id
                                );
                                if (
                                  currentIdx !== -1 &&
                                  currentIdx < libraryVideos.length - 1
                                ) {
                                  selectVideo(libraryVideos[currentIdx + 1]);
                                }
                              }
                            }}
                          />
                        </>
                      ) : fetchingVideoDetails ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                          <Loading white size={24} />
                          <span className="text-white bg-black bg-opacity-50 p-2 rounded mt-2">
                            Processing video, please wait...
                          </span>
                        </div>
                      ) : (
                        <div className="relative w-full h-full">
                          {videoThumbnail && (
                            <img
                              src={videoThumbnail}
                              alt="Video Thumbnail"
                              className="w-full h-full object-contain"
                            />
                          )}
                          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
                            <span className="text-white bg-black bg-opacity-50 p-2 rounded">
                              Video not available for playback
                            </span>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                if (
                                  selectedVideo &&
                                  selectedVideo._id &&
                                  selectedSeasonId &&
                                  selectedGameId
                                ) {
                                  await handleFetchGamesVideos(
                                    selectedSeasonId,
                                    selectedGameId
                                  );
                                  fetchVideoDetails(selectedVideo._id);
                                }
                              }}
                              disabled={
                                fetchingVideoDetails ||
                                hasActiveUploads() ||
                                isTrimming()
                              }
                            >
                              {fetchingVideoDetails ? (
                                <Loading size={20} />
                              ) : (
                                "Refetch"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Loading size={20} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                {/* Video Player Skeleton with "No video selected" message */}
                <div className="bg-gray-200 w-full aspect-video flex items-center justify-center rounded-lg relative">
                  <div className="w-full h-full bg-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-full h-12 bg-gray-400 rounded mx-auto mb-4 "></div>
                      <div className="h-4 bg-gray-400 rounded w-48 mx-auto mb-2 "></div>
                      <div className="h-3 bg-gray-400 rounded w-32 mx-auto "></div>
                      <h2 className="text-base font-medium mb-2">No Video</h2>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* video chapters */}
          <div className="min-h-auto h-full p-4 overflow-y-auto flex flex-col justify-center items-center">
            {fetchingVideos ? (
              <div className="flex items-center justify-center h-full">
                <Loading />
              </div>
            ) : (
              <>
                {libraryVideos && libraryVideos.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {libraryVideos
                        .slice(0, showAllVideos ? libraryVideos.length : 4)
                        .map((video) => {
                          return (
                            <Button
                              key={video._id}
                              variant={
                                selectedVideo?._id === video._id
                                  ? "secondary"
                                  : "outline"
                              }
                              className="flex flex-col items-center h-auto p-1"
                              onClick={() => selectVideo(video)}
                              disabled={isTrimming()}
                            >
                              <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-200">
                                {video.videoThumbnail ? (
                                  <img
                                    src={video.videoThumbnail}
                                    alt={video.title || "Video"}
                                    className="object-cover w-full h-full"
                                  />
                                ) : (
                                  <span className="text-xs">No Thumbnail</span>
                                )}
                              </div>
                              <span className="text-sm font-medium truncate w-full text-center">
                                {video.title || "Untitled"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {video.videoDuration
                                  ? video.videoDuration
                                  : "00:00"}
                              </span>
                            </Button>
                          );
                        })}
                    </div>
                    {libraryVideos.length > 4 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowAllVideos(!showAllVideos)}
                          disabled={isTrimming()}
                        >
                          {showAllVideos
                            ? "Show Less"
                            : `Show More ${
                                libraryVideos.length &&
                                `(${libraryVideos.length - 4})`
                              } `}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* library section */}
        {/* <div className="w-1/4 border-l p-4 overflow-y-auto"> */}
        <div className="lg:w-1/4 lg:h-full w-full h-auto border-l py-4 px-2 lg:overflow-y-auto bg-transparent">
          <div className="w-full h-auto flex justify-between items-center gap-0 py-4 px-0">
            <Button
              size={"sm"}
              className="text-xs"
              onClick={toggleEditMode}
              disabled={
                loading ||
                hasActiveUploads() ||
                isTrimming() ||
                deletingVideoId !== null
              }
            >
              {editMode ? (
                <Undo className="mr-2 h-4 w-4" />
              ) : (
                <Edit className="mr-2 h-4 w-4" />
              )}
              EDIT
            </Button>
            <Button
              size={"sm"}
              className="text-xs"
              onClick={() => setShowLibrary(!showLibrary)}
              disabled={
                hasActiveUploads() || isTrimming() || deletingVideoId !== null
              }
            >
              LIBRARY
            </Button>
            <Button
              size={"sm"}
              className="text-xs"
              onClick={() => setShowMenu(!showMenu)}
              disabled={
                hasActiveUploads() || isTrimming() || deletingVideoId !== null
              }
            >
              <MenuIcon />
            </Button>
          </div>

          <Card className="border px-2 bg-[#858585] gap-1">
            <h2 className="text-lg font-semibold mb-0 bg-[#858585]">
              {(() => {
                const game = seasons
                  .flatMap((season) => season.games)
                  .find((game) => game.id === selectedGameId);
                return game?.name || "Library";
              })()}
            </h2>
            {fetchingVideos ? (
              <div className="flex items-center justify-center bg-transparent">
                <Loading />
              </div>
            ) : (
              <>
                <ol className="list-none space-y-1 ">
                  {!libraryVideos || libraryVideos.length === 0 ? (
                    <>
                      {activeUploads[selectedGameId || ""]?.files.length >
                      0 ? null : (
                        <li className="w-full h-auto flex justify-center items-center">
                          No videos found
                        </li>
                      )}
                    </>
                  ) : (
                    <>
                      {libraryVideos?.map((video) => (
                        <li
                          key={video._id}
                          className={`px-0 text-[0.85rem] hover:bg-[#858585] rounded flex justify-between items-center gap-2 ${
                            isTrimming() || deletingVideoId === video._id
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer"
                          }`}
                          onClick={() =>
                            !isTrimming() &&
                            !editMode &&
                            deletingVideoId !== video._id &&
                            selectVideo(video)
                          }
                        >
                          <div className="flex justify-start items-center gap-2 w-[80%] text-wrap whitespace-break-spaces">
                            {editMode ? (
                              <Button
                                size={"icon"}
                                variant={"destructive"}
                                className="h-6 w-6 bg-transparent text-destructive hover:bg-white/30 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVideo(video);
                                }}
                                disabled={
                                  isTrimming() || deletingVideoId === video._id
                                }
                              >
                                {deletingVideoId === video._id ? (
                                  <Loading size={16} />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            ) : (
                              <Checkbox
                                className="border-[#454444] cursor-pointer"
                                checked={selectedVideo?._id === video._id}
                              />
                            )}
                            <span className="truncate block">
                              {deletingVideoId === video._id ? (
                                <span className="flex items-center gap-2">
                                  {/* <Loading size={12} /> */}
                                  Deleting...
                                </span>
                              ) : (
                                video.title || "no title"
                              )}
                            </span>
                          </div>
                          <Button
                            size={"icon"}
                            variant={"link"}
                            onClick={(e) => {
                              e.stopPropagation();
                              showShareModal(
                                `sharedVideo?id=${video._id}` as string
                              );
                            }}
                            disabled={
                              isTrimming() || deletingVideoId === video._id
                            }
                          >
                            <Share2 className="w-8 h-8" />
                          </Button>
                        </li>
                      ))}
                    </>
                  )}
                </ol>
              </>
            )}

            {activeUploads[selectedGameId || ""]?.files.map((file, idx) => (
              <li
                key={`upload-${idx}`}
                className="px-0 text-[0.85rem] h-auto text-primary flex items-center gap-2 max-w-[80%]"
              >
                <span className="">
                  {file.status === "uploading" ? (
                    <Loading size={16} />
                  ) : file.status === "error" ? (
                    <CircleX size={16} className=" text-red-500" />
                  ) : null}
                </span>
                <span className="truncate">
                  {file.name}
                  {file.status === "error" && file.error && ` (${file.error})`}
                </span>
              </li>
            ))}
          </Card>
        </div>
      </div>

      {/* * upload video confirmation modal  */}
      {/* ------ */}
      <Dialog
        open={uploadConfirmation.open}
        onOpenChange={(open) =>
          setUploadConfirmation({ ...uploadConfirmation, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Upload</DialogTitle>
            <DialogDescription>
              {uploadConfirmation.files.length === 1
                ? `Are you sure you want to upload ${uploadConfirmation.files[0].name}?`
                : `Are you sure you want to upload these ${uploadConfirmation.files.length} videos?`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto my-2">
            {uploadConfirmation.files.map((file, idx) => (
              <div
                key={file.name + idx}
                className="flex items-center gap-2 bg-gray-100 rounded p-2"
              >
                <span className="flex-1 truncate text-xs">{file.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setUploadConfirmation((prev) => ({
                      ...prev,
                      files: prev.files.filter((_, i) => i !== idx),
                      muteMap: Object.fromEntries(
                        Object.entries(prev.muteMap).filter(
                          ([k]) => k !== file.name
                        )
                      ),
                    }));
                  }}
                >
                  <CircleX className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          {/* Single Remove Sound checkbox for all files */}
          {uploadConfirmation.files.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="mute-all"
                checked={uploadConfirmation.files.every(
                  (file) => uploadConfirmation.muteMap[file.name]
                )}
                onCheckedChange={(checked) => {
                  setUploadConfirmation((prev) => ({
                    ...prev,
                    muteMap: Object.fromEntries(
                      prev.files.map((file) => [file.name, !!checked])
                    ),
                  }));
                }}
              />
              <label
                htmlFor="mute-all"
                className="text-xs cursor-pointer select-none"
              >
                Remove Sound
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleUploadConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUploadConfirmation(true)}
              disabled={loading || uploadConfirmation.files.length === 0}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sidebar video menu */}
      {showMenu && (
        <div className="fixed top-0 right-0 h-full w-[70vw] md:w-[25vw] bg-white shadow-lg z-50 flex flex-col border-l border-gray-200">
          <div className="flex justify-end items-center mt-2 py-6 px-4 ">
            {/* <span className="font-semibold text-lg">Menu</span> */}
            <Button onClick={() => setShowMenu(false)}>
              <CircleX className="h-8 w-8" />
            </Button>
          </div>
          <div className="flex-1 flex flex-col justify-end p-4">
            {refreshToken ? (
              <Button
                className="w-full h-auto p-[2%] rounded-full"
                onClick={logout}
              >
                Logout
              </Button>
            ) : (
              <Button asChild className="w-full h-auto p-[2%] rounded-full">
                <Link href="/login">Sign&nbsp;Up&nbsp;Or&nbsp;Login</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Library Sidebar */}
      {(() => {
        if (showLibrary) {
          console.log(
            "Rendering LibrarySidebar, showLibrary:",
            showLibrary,
            "librarySeasons:",
            librarySeasons
          );
        }
        return null;
      })()}
      {showLibrary && (
        <LibrarySidebar
          seasons={librarySeasons}
          onClose={() => setShowLibrary(false)}
          onToggleSeason={(seasonId) => {
            // Library-specific toggle that only affects library state
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((season) =>
                season.id === seasonId
                  ? { ...season, open: !season.open }
                  : season
              )
            );
          }}
          onToggleGame={(seasonId, gameId) => {
            // Library-specific toggle that only affects library state
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((s) =>
                s.id === seasonId
                  ? {
                      ...s,
                      games: s.games.map((g) =>
                        g.id === gameId ? { ...g, open: !g.open } : g
                      ),
                    }
                  : s
              )
            );
          }}
          onDragDrop={handleLibraryDragDrop}
          onDeleteSeason={async (seasonId) => {
            // Handle season deletion in library
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.filter((season) => season.id !== seasonId)
            );
            // Also update main seasons if it exists there
            setSeasons((prevSeasons) =>
              prevSeasons.filter((season) => season.id !== seasonId)
            );

            // Try to navigate to next season if the deleted season was selected
            if (selectedSeasonId === seasonId) {
              const nextSeason = findNextSeason(seasonId, seasons);
              if (nextSeason) {
                await navigateToNextSeason(nextSeason);
                toast.success(
                  "Season deleted successfully. Navigated to next season."
                );
              } else {
                cleanupVideoPlayback(true); // Clear all if no next season
                toast.success(
                  "Season deleted successfully. No more seasons available."
                );
              }
            }
          }}
          onDeleteGame={async (seasonId, gameId) => {
            // Handle game deletion in library
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((season) =>
                season.id === seasonId
                  ? {
                      ...season,
                      games: season.games.filter((game) => game.id !== gameId),
                    }
                  : season
              )
            );
            // Also update main seasons if it exists there
            setSeasons((prevSeasons) =>
              prevSeasons.map((season) =>
                season.id === seasonId
                  ? {
                      ...season,
                      games: season.games.filter((game) => game.id !== gameId),
                    }
                  : season
              )
            );

            // Try to navigate to next game if the deleted game was selected
            if (selectedGameId === gameId) {
              const currentSeason = seasons.find((s) => s.id === seasonId);
              if (currentSeason) {
                const nextGame = findNextGame(gameId, currentSeason.games);
                if (nextGame) {
                  await navigateToNextGame(nextGame, seasonId);
                  toast.success(
                    "Game deleted successfully. Navigated to next game."
                  );
                } else {
                  cleanupVideoPlayback(true); // Clear all if no next game
                  toast.success(
                    "Game deleted successfully. No more games in this season."
                  );
                }
              } else {
                cleanupVideoPlayback(true);
                toast.success("Game deleted successfully");
              }
            }
          }}
          onDeleteVideo={async (videoId) => {
            // Handle video deletion in library
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((season) => ({
                ...season,
                games: season.games.map((game) => ({
                  ...game,
                  videos: game.videos.filter((video) => video._id !== videoId),
                })),
              }))
            );
            // Also update main seasons if it exists there
            setSeasons((prevSeasons) =>
              prevSeasons.map((season) => ({
                ...season,
                games: season.games.map((game) => ({
                  ...game,
                  videos: game.videos.filter((video) => video._id !== videoId),
                })),
              }))
            );
            // Also update libraryVideos if it exists there
            setLibraryVideos((prevVideos) =>
              prevVideos.filter((video) => video._id !== videoId)
            );

            // Try to navigate to next video if the deleted video was selected
            if (selectedVideo?._id === videoId) {
              const remainingVideos = libraryVideos.filter(
                (v) => v._id !== videoId
              );
              const nextVideo = findNextVideo(videoId, remainingVideos);

              if (nextVideo) {
                await navigateToNextVideo(nextVideo);
                toast.success(
                  "Video deleted successfully. Navigated to next video."
                );
              } else {
                cleanupVideoPlayback(false); // Don't clear season/game selections, just video
                toast.success(
                  "Video deleted successfully. No more videos in this game."
                );
              }
            }
          }}
          onRenameVideo={async (videoId, newTitle) => {
            // Handle video renaming in library
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((season) => ({
                ...season,
                games: season.games.map((game) => ({
                  ...game,
                  videos: game.videos.map((video) =>
                    video._id === videoId
                      ? { ...video, title: newTitle }
                      : video
                  ),
                })),
              }))
            );
            // Also update main seasons if it exists there
            setSeasons((prevSeasons) =>
              prevSeasons.map((season) => ({
                ...season,
                games: season.games.map((game) => ({
                  ...game,
                  videos: game.videos.map((video) =>
                    video._id === videoId
                      ? { ...video, title: newTitle }
                      : video
                  ),
                })),
              }))
            );
            // Also update libraryVideos if it exists there
            setLibraryVideos((prevVideos) =>
              prevVideos.map((video) =>
                video._id === videoId ? { ...video, title: newTitle } : video
              )
            );
            // Also update selectedVideo if it's the renamed video
            if (selectedVideo?._id === videoId) {
              setSelectedVideo((prev) =>
                prev ? { ...prev, title: newTitle } : null
              );
            }
          }}
          onRenameSeason={async (seasonId, newName) => {
            // Handle season renaming in library
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((season) =>
                season.id === seasonId ? { ...season, name: newName } : season
              )
            );
            // Also update main seasons if it exists there
            setSeasons((prevSeasons) =>
              prevSeasons.map((season) =>
                season.id === seasonId ? { ...season, name: newName } : season
              )
            );
          }}
          onRenameGame={async (gameId, newName) => {
            // Handle game renaming in library
            setLibrarySeasons((prevSeasons) =>
              prevSeasons.map((season) => ({
                ...season,
                games: season.games.map((game) =>
                  game.id === gameId ? { ...game, name: newName } : game
                ),
              }))
            );
            // Also update main seasons if it exists there
            setSeasons((prevSeasons) =>
              prevSeasons.map((season) => ({
                ...season,
                games: season.games.map((game) =>
                  game.id === gameId ? { ...game, name: newName } : game
                ),
              }))
            );
          }}
        />
      )}

      {/* show share video modal here */}
      {shareModal && (
        <ShareVideoModal
          setShareModal={setShareModal}
          shareVideoId={shareVideoId}
        />
      )}
    </>
  );
}

// ********************************************************************************
