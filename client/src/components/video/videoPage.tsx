"use client";

import {
  addGameToSeason,
  createSeasonFolder,
  deleteGame,
  deleteSeasonFolder,
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
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState("");

  const [uploadConfirmation, setUploadConfirmation] = useState<{
    open: boolean;
    files: File[];
    muteMap: { [filename: string]: boolean };
  }>({ open: false, files: [], muteMap: {} });

  const videoRef = useRef<HTMLVideoElement>(null);
  // Hls.js instance ref
  const hlsInstance = useRef<Hls | null>(null);
  const { refreshToken, user, logout } = useAuth();

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
        setSeasons(seasonsWithGames);
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
    if (!user || !user._id) {
      toast.error("User not found. Please login.");
      return;
    }
    try {
      setDeleteLoading(true);

      const res = await deleteSeasonFolder(seasonId, user._id);
      if (res.success) {
        // Refetch all seasons and games after deletion, reset all selections
        await fetchSeasons();
        setSelectedSeasonId(null);
        setSelectedGameId(null);
        setSelectedVideo(null);
        setLibraryVideos([]);
        setSelectedVideoDetails(null);
        toast.success("Season deleted successfully");
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

        // Clear the video-related states if we deleted the currently selected game
        if (selectedGameId === gameId) {
          setSelectedGameId(null);
          setSelectedVideo(null);
          setLibraryVideos([]);
          setSelectedVideoDetails(null);
        }

        toast.success("Game deleted successfully");
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

  // const shareSeason = (seasonId: string) => {
  //   const base = typeof window !== "undefined" ? window.location.origin : "";
  //   const link = `${base}/share/${seasonId}`;
  //   setShareLink(link);
  //   navigator.clipboard.writeText(link).then(() => {
  //     toast.success("Copied to clipboard!");
  //   });
  // };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const selectVideo = (video: Video) => {
    setSelectedVideo(video);
  };

  // FETCHING VIDEOS
  // Modified handleFetchGamesVideos - no upload restrictions
  const handleFetchGamesVideos = async (seasonId: string, gameId: string) => {
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

        // Select the first video if available
        if (videos.length > 0) {
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

  // 888888888888888888888888****
  const handleUploadConfirmation = async (confirmed: boolean) => {
    setUploadConfirmation({ open: false, files: [], muteMap: {} });
    if (!confirmed || !uploadConfirmation.files.length || !selectedGameId)
      return;

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

            // Silently refresh the game's videos in the background
            if (selectedGameId === uploadingGameId) {
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

                // Only update libraryVideos if we're currently viewing this game
                // if (uploadingGameId && uploadingGameId === selectedGameId) {
                setLibraryVideos(updatedVideos);
                // }
              }
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setActiveUploads((prev) => ({
            ...prev,
            [selectedGameId]: {
              files:
                prev[selectedGameId]?.files.map((f) =>
                  f.name === file.name
                    ? {
                        ...f,
                        status: "error" as const,
                        error: errorMessage,
                      }
                    : f
                ) || [],
            },
          }));
        }
      }
    } finally {
      // setUploadingGameId(null);
      // Clean up completed uploads after a delay
      setTimeout(() => {
        setActiveUploads((prev) => {
          const newState = { ...prev };
          if (newState[selectedGameId]?.files.length === 0) {
            delete newState[selectedGameId];
          }
          return newState;
        });
      }, 3000);
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
  }, [selectedVideoDetails]);

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

  // Add this function to handle the video replacement
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
      const response = await updateVideoFile(videoId, file);

      if (response.success) {
        // Refresh the video list
        if (selectedSeasonId && selectedGameId) {
          await handleFetchGamesVideos(selectedSeasonId, selectedGameId);
        }

        setReplacingVideo({
          videoId,
          status: "success",
        });

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
              disabled={loading}
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
              disabled={!selectedSeasonId || loading}
            >
              <PlusIcon /> GAME
            </Button>
            <Button
              size={"sm"}
              variant={
                !selectedGameId || loading || editMode ? "outline" : "default"
              }
              disabled={!selectedGameId || loading || editMode}
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
                            disabled={loading}
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
                              disabled={loading}
                            />
                          ) : (
                            <CardTitle
                              className="text-sm cursor-pointer"
                              onDoubleClick={() =>
                                startRenaming("season", season.id, season.name)
                              }
                              onClick={() => setSelectedSeasonId(season.id)}
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
                                disabled={loading}
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
                                      disabled={deleteLoading}
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
                                  disabled={fetchingVideos}
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
                                    disabled={loading}
                                  />
                                ) : (
                                  <span
                                    className="text-sm cursor-pointer"
                                    onDoubleClick={() =>
                                      startRenaming("game", game.id, game.name)
                                    }
                                    onClick={() =>
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
                                        disabled={loading}
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
                                      disabled={loading}
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
                                      disabled={deleteLoading}
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
          <div className="flex-1 p-4 border-b aspect-video">
            {fetchingVideoDetails || replacingVideo?.status === "uploading" ? (
              <div className="h-full flex items-center justify-center">
                <Loading />
              </div>
            ) : selectedVideo ? (
              <div className="h-full flex flex-col">
                {/* ---------trim-------------- */}

                <div className="bg-black rounded-lg aspect-video flex flex-col items-center justify-center relative">
                  {selectedVideoDetails ? (
                    <>
                      {selectedVideoDetails.streamingPlaylists &&
                      selectedVideoDetails.streamingPlaylists.length > 0 ? (
                        // <>
                        //   {/* Trim slider with thumbnails below video */}
                        //   {editMode &&
                        //     selectedVideoDetails.duration &&
                        //     selectedVideoDetails.duration > 0 && (
                        //       <div className="w-full z-50 flex flex-col items-center mt-0 px-0">
                        //         <TrimSliderWithThumbnails
                        //           duration={selectedVideoDetails.duration}
                        //           videoUrl={
                        //             selectedVideoDetails.streamingPlaylists[0]
                        //               .files[0]?.fileUrl
                        //           }
                        //           videoId={selectedVideo?._id}
                        //           video={selectedVideo as VideoDetails}
                        //           onTrimComplete={async (blob, start, end) => {
                        //             setTrimmedVideo({ blob, start, end });
                        //             console.log(
                        //               "Trimmed video saved to state:",
                        //               {
                        //                 blob,
                        //                 startTime: start,
                        //                 endTime: end,
                        //                 duration: end - start,
                        //               }
                        //             );

                        //             if (selectedVideo?._id) {
                        //               await handleReplaceVideo(
                        //                 selectedVideo._id,
                        //                 blob
                        //               );
                        //             }
                        //           }}
                        //         />
                        //       </div>
                        //     )}

                        //   <video
                        //     ref={videoRef}
                        //     controls
                        //     autoPlay
                        //     className="w-full h-full rounded-lg"
                        //     poster={videoThumbnail}
                        //     onTimeUpdate={(e) => {
                        //       setCurrentPlaybackTime(
                        //         e.currentTarget.currentTime
                        //       );
                        //     }}
                        //     onEnded={() => {
                        //       // Find the index of the current video
                        //       const currentIdx = libraryVideos.findIndex(
                        //         (v) => v._id === selectedVideo?._id
                        //       );
                        //       if (
                        //         currentIdx !== -1 &&
                        //         currentIdx < libraryVideos.length - 1
                        //       ) {
                        //         selectVideo(libraryVideos[currentIdx + 1]);
                        //       }
                        //     }}
                        //   />
                        // </>

                        <>
                          {/* Add the trimmer component */}
                          {editMode && selectedVideoDetails.duration > 0 && (
                            <div className="w-full z-50 flex flex-col items-center px-0">
                              <TrimSliderWithThumbnails
                                duration={selectedVideoDetails.duration}
                                videoUrl={
                                  selectedVideoDetails.streamingPlaylists[0]
                                    .files[0]?.fileUrl
                                }
                                videoThumbnail={videoThumbnail}
                                videoRef={videoRef} // Pass your video ref
                                videoId={selectedVideo?._id}
                                onTrimComplete={async (blob, start, end) => {
                                  try {
                                    const formData = new FormData();
                                    formData.append(
                                      "videoFile",
                                      blob,
                                      `trimmed-${Date.now()}.mp4`
                                    );

                                    const response = await axios.post(
                                      `/api/seasons/update-video/${selectedVideo._id}`,
                                      formData,
                                      {
                                        headers: {
                                          "Content-Type": "multipart/form-data",
                                        },
                                        withCredentials: true,
                                      }
                                    );

                                    if (response.data.success) {
                                      toast.success(
                                        "Video trimmed and updated successfully"
                                      );
                                      // Refresh the video list
                                      if (selectedSeasonId && selectedGameId) {
                                        await handleFetchGamesVideos(
                                          selectedSeasonId,
                                          selectedGameId
                                        );
                                      }
                                    } else {
                                      throw new Error(
                                        response.data.message || "Update failed"
                                      );
                                    }
                                  } catch (error) {
                                    toast.error(
                                      `Failed to update video: ${error.message}`
                                    );
                                  }
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
                          />
                        </>
                      ) : fetchingVideoDetails ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                          <Loading size={24} />
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
                              disabled={fetchingVideoDetails}
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
                <div className="bg-gray-200 w-full aspect-video flex items-center justify-center rounded-lg">
                  <span className="text-gray-500">No video selected</span>
                </div>
                <div className="mt-4 text-center">
                  <h2 className="text-lg font-semibold">No Video Selected</h2>
                  <p className="text-sm text-gray-500">
                    Select a video from the library to play
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* video chapters */}
          <div className="h-auto p-4 overflow-y-auto">
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
                                {video.videoDuration || "00:00"}
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
              disabled={loading}
            >
              {editMode ? (
                <Undo className="mr-2 h-4 w-4" />
              ) : (
                <Edit className="mr-2 h-4 w-4" />
              )}
              EDIT
            </Button>
            <Button size={"sm"} className="text-xs">
              LIBRARY
            </Button>
            <Button
              size={"sm"}
              className="text-xs"
              onClick={() => setShowMenu(!showMenu)}
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
                          className="px-0 text-[0.85rem] hover:bg-[#858585] rounded cursor-pointer flex justify-between items-center gap-2"
                          onClick={() => selectVideo(video)}
                        >
                          <div className="flex justify-start items-center gap-2 w-[80%] text-wrap whitespace-break-spaces">
                            <Checkbox
                              className="border-[#454444] cursor-pointer"
                              checked={selectedVideo?._id === video._id}
                            />
                            <span className="truncate block">
                              {video.title || "no title"}
                            </span>
                          </div>
                          <Button
                            size={"icon"}
                            variant={"link"}
                            onClick={() =>
                              showShareModal(
                                `sharedVideo?id=${video._id}` as string
                              )
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

      {/* show share video modal here  */}
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
