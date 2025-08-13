"use client";

import {
  Calendar,
  Circle,
  CircleCheck,
  FolderOpen,
  Video,
  Download,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getGameDetails, getVideoDetails } from "@/app/api/peertube/api";
import Loading from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Hls from "hls.js";
import { useAuth } from "@/context/AuthContext";

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
  videoDuration?: string;
};

type Game = {
  id: string;
  name: string;
  videos: Video[];
  description?: string;
  createdAt?: string;
  totalVideos?: number;
  seasonName?: string;
};

type VideoDetails = {
  name?: string;
  title?: string;
  duration?: number;
  muteVideo?: boolean;
  category?: { label?: string };
  thumbnailPath?: string;
  fileUrl?: string;
  [key: string]: unknown;
};

const GameComponent = () => {
  const searchParams = useSearchParams();
  const shareGameId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [game, setGame] = useState<Game | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedVideoDetails, setSelectedVideoDetails] =
    useState<VideoDetails | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const hlsInstance = useRef<Hls | null>(null);

  // Fetch game details
  const fetchGameDetails = async (gameId: string) => {
    if (!gameId) {
      setError("No game ID provided. Please check the link and try again.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get game details with season info and videos
      const gameRes = await getGameDetails(gameId);
      if (!gameRes.success || !gameRes.data) {
        setError(
          "Failed to fetch game details. The game may not exist or you may not have access."
        );
        return;
      }

      const gameData = gameRes.data as any;
      const gameInfo: Game = {
        id: gameData.id,
        name: gameData.name,
        videos: gameData.videos || [],
        description: gameData.description,
        createdAt: gameData.createdAt,
        totalVideos: gameData.totalVideos,
        seasonName: gameData.seasonName,
      };

      setGame(gameInfo);

      // Auto-select first video if available
      if (gameData.videos && gameData.videos.length > 0) {
        const firstVideo = gameData.videos[0];
        setSelectedVideo(firstVideo);
        await fetchVideoDetails(firstVideo._id || "");
      }
    } catch (error) {
      console.error("Error fetching game details:", error);

      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes("Route not found")) {
          setError(
            "Game not found. The game may have been deleted or the link is invalid."
          );
        } else if (error.message.includes("JSON")) {
          setError("Server error occurred. Please try again later.");
        } else {
          setError(
            "Network error occurred. Please check your connection and try again."
          );
        }
      } else {
        setError("An unexpected error occurred. Please try again later.");
      }

      toast.error("Please try again later");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch video details
  const fetchVideoDetails = async (videoId: string) => {
    if (!videoId) return;

    try {
      setIsVideoLoading(true);
      const res = await getVideoDetails(videoId);

      console.log("API Response:", res);

      if (res.success && res.data && typeof res.data === "object") {
        // Transform the database response to match expected format
        const videoData = res.data as any;

        const transformedVideoDetails = {
          name: videoData.title || videoData.name || "",
          title: videoData.title || videoData.name || "",
          duration: videoData.videoDuration || videoData.duration || 0,
          muteVideo: false,
          category: { label: "Sports" },
          thumbnailPath:
            videoData.videoThumbnail || videoData.thumbnailPath || "",
          fileUrl: videoData.fileUrl || "",
        };

        setSelectedVideoDetails(transformedVideoDetails);

        // Set thumbnail - videoThumbnail already contains the complete URL
        const thumbnailPath = transformedVideoDetails.thumbnailPath;
        if (thumbnailPath) {
          console.log("Setting thumbnail from database:", thumbnailPath);
          setVideoThumbnail(thumbnailPath);
        } else {
          console.log("No thumbnail found, using fallback SVG");
          // Use fallback SVG
          setVideoThumbnail(
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA4MCA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjQ1IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiAyMi41QzMyIDIxLjExOTQgMzMuMTE5NCAyMCAzNC41IDIwSDQ1LjVDNDYuODgwNiAyMCA0OCAyMS4xMTk0IDQ4IDIyLjVWMzIuNUM0OCAzMy44ODA2IDQ2Ljg4MDYgMzUgNDUuNSAzNUgzNC41QzMzLjExOTQgMzUgMzIgMzMuODgwNiAzMiAzMi41VjIyLjVaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0zNiAyNkwyOCAzMkw0MiAzMkwzNiAyNloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo="
          );
        }

        // Simulate view count for demo
        setViewCount(Math.floor(Math.random() * 10000) + 1000);
      } else {
        console.error(
          "Error fetching video details:",
          res.message || "Unknown error"
        );
        console.error("Full response:", res);
        setSelectedVideoDetails(null);
        toast.error("Failed to fetch video details");
      }
    } catch (error) {
      console.log("🚀 ~ fetchVideoDetails ~ error:", error);
      console.error("Full error object:", error);
      setSelectedVideoDetails(null);

      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes("Route not found")) {
          toast.error("Video not found or not accessible");
        } else if (error.message.includes("JSON")) {
          toast.error("Server error occurred while loading video");
        } else {
          toast.error("Failed to load video");
        }
      } else {
        toast.error("Failed to load video");
      }
    } finally {
      setIsVideoLoading(false);
    }
  };

  // Handle video selection
  const selectVideo = async (video: Video) => {
    setSelectedVideo(video);
    if (video._id) {
      await fetchVideoDetails(video._id);
    }
  };

  // Share functionality
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: game?.name || "Check out this game",
          text: game?.description || "Amazing sports game",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  // Format duration
  const formatDuration = (duration: number | string) => {
    // If duration is already a formatted string (like "01:34"), return it as is
    if (typeof duration === "string" && duration.includes(":")) {
      return duration;
    }

    // Convert to number if it's a string
    const seconds =
      typeof duration === "string" ? parseFloat(duration) : duration;

    // Ensure seconds is a valid number
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return "0:00";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Format view count
  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Load game on mount
  useEffect(() => {
    if (shareGameId) {
      fetchGameDetails(shareGameId);
    }
  }, [shareGameId]);

  // Video player setup
  useEffect(() => {
    if (
      selectedVideoDetails &&
      selectedVideoDetails.fileUrl &&
      videoRef.current
    ) {
      const videoSrc = selectedVideoDetails.fileUrl;
      console.log("Video source:", videoSrc);

      // Handle HLS streams (.m3u8 files)
      if (videoSrc.endsWith(".m3u8")) {
        console.log("Loading HLS stream:", videoSrc);
        if (Hls.isSupported()) {
          if (hlsInstance.current) {
            hlsInstance.current.destroy();
          }
          const hls = new Hls();
          hls.loadSource(videoSrc);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest parsed, video loading complete");
            setIsVideoLoading(false);
            videoRef.current?.play();
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  toast.error("Network error occurred");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  toast.error("Media error occurred");
                  hls.recoverMediaError();
                  break;
                default:
                  toast.error("Failed to load video");
                  break;
              }
            }
          });
          hlsInstance.current = hls;
        } else if (
          videoRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          // For Safari
          console.log("Loading HLS stream in Safari:", videoSrc);
          videoRef.current.src = videoSrc;
          videoRef.current.addEventListener("loadedmetadata", () => {
            console.log("Safari video metadata loaded");
            setIsVideoLoading(false);
          });
        }
      }
      // Handle direct video files (mp4, webm, etc.)
      else if (videoSrc) {
        console.log("Setting direct video source:", videoSrc);
        if (hlsInstance.current) {
          hlsInstance.current.destroy();
          hlsInstance.current = null;
        }
        videoRef.current.src = videoSrc;
        videoRef.current.addEventListener("loadedmetadata", () => {
          console.log("Direct video metadata loaded");
          setIsVideoLoading(false);
        });
      }
    } else {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = "";
      }
      setIsVideoLoading(false);
    }

    return () => {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
    };
  }, [selectedVideoDetails]);

  const handleDownloadClick = () => {
    setShowDownloadModal(true);
  };

  const handleSignupRedirect = () => {
    window.location.href = "/login";
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !game) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <Card className="p-8 text-center max-w-md mx-4">
            <CardContent>
              <div className="text-6xl mb-4">🎮</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {error ? "Error Loading Game" : "Game Not Found"}
              </h2>
              <p className="text-gray-600 mb-6">
                {error ||
                  "The game you're looking for doesn't exist or has been removed."}
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="w-full"
                >
                  Go Back
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-2">Common issues:</p>
                <ul className="text-xs text-gray-500 space-y-1 text-left">
                  <li>• Check if the game link is correct</li>
                  <li>• Verify your internet connection</li>
                  <li>• The game may have been deleted</li>
                  <li>• Try refreshing the page</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-transparent">
        <div className="container mx-auto px-2 lg:px-4 py-4">
          <div className="flex lg:flex-row flex-col justify-start items-start gap-2 lg:h-full h-auto bg-transparent">
            {/* Left sidebar: Game info and videos list */}
            <div className="lg:w-1/4 lg:h-full w-full h-auto border-r py-4 px-2 bg-transparent lg:overflow-y-auto">
              {!game ? (
                // Skeleton loading for game info
                <Card
                  className="px-0 py-2 my-1 border border-[#454444]"
                  style={{ backgroundColor: "rgb(133, 133, 133)" }}
                >
                  <CardContent className="px-3 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="h-4 bg-gray-400 rounded w-32 mb-2 animate-pulse"></div>
                        <div className="mt-1 flex items-center gap-3 text-[0.7rem] text-black/80">
                          <div className="h-3 bg-gray-400 rounded w-16 animate-pulse"></div>
                          <div className="h-3 bg-gray-400 rounded w-16 animate-pulse"></div>
                          <div className="h-3 bg-gray-400 rounded w-16 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card
                  className="px-0 py-2 my-1 border border-[#454444]"
                  style={{ backgroundColor: "rgb(133, 133, 133)" }}
                >
                  <CardContent className="px-3 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <CardTitle className="text-sm truncate">
                            {game.name}
                          </CardTitle>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[0.7rem] text-black/80">
                          <span className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {game.totalVideos || 0} Videos
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {game.createdAt
                              ? new Date(game.createdAt).toLocaleDateString()
                              : "N/A"}
                          </span>
                          {game.seasonName && (
                            <span className="flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              {game.seasonName}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Sharing disabled for game */}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Download Button - Only show if user is not logged in */}
              {!user && (
                <Card className="px-0 py-2 my-1 mt-4 border-0">
                  <CardContent className="px-3 py-3">
                    <Button
                      onClick={handleDownloadClick}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Middle: Video player and chapters */}
            <div className="flex-1 flex flex-col lg:w-flex-1 lg:h-full w-full h-auto">
              <div className="flex-1 p-0 border-b aspect-video bg-black rounded">
                <div className="h-full w-full relative">
                  {!selectedVideo ? (
                    // Skeleton loading when no video is selected
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-400 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
                          <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
                        </div>
                        <div className="h-4 bg-gray-400 rounded w-48 mx-auto mb-2 animate-pulse"></div>
                        <p className="text-gray-600 text-lg font-medium">
                          No Video Selected
                        </p>
                        <p className="text-gray-500 text-sm mt-2">
                          Select a video from the list
                        </p>
                      </div>
                    </div>
                  ) : !selectedVideoDetails ? (
                    // Skeleton loading when video details are not yet loaded
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gray-400 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
                          <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
                        </div>
                        <div className="h-4 bg-gray-400 rounded w-48 mx-auto mb-2 animate-pulse"></div>
                        <p className="text-gray-600 text-lg font-medium">
                          Loading video details...
                        </p>
                        <p className="text-gray-500 text-sm mt-2">
                          Please wait a moment
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-contain"
                        controls
                        autoPlay
                        poster={videoThumbnail}
                        onLoadStart={() => setIsVideoLoading(true)}
                        onCanPlay={() => setIsVideoLoading(false)}
                        onTimeUpdate={(e) =>
                          setCurrentPlaybackTime(e.currentTarget.currentTime)
                        }
                        onError={() => {
                          setIsVideoLoading(false);
                          toast.error("Failed to load video");
                        }}
                      />
                      {isVideoLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-90">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gray-400 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
                              <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
                            </div>
                            <div className="h-4 bg-gray-400 rounded w-48 mx-auto mb-2 animate-pulse"></div>
                            <p className="text-gray-600 text-lg font-medium">
                              Loading video...
                            </p>
                            <p className="text-gray-500 text-sm mt-2">
                              Please wait a moment
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Chapters grid below player */}
              <div className="h-auto p-4 overflow-y-auto">
                {!game.videos || game.videos.length === 0 ? (
                  // Skeleton loading for thumbnail preview when no videos are available
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center h-auto p-1"
                      >
                        <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-200 animate-pulse">
                          <div className="w-full h-full bg-gray-300 animate-pulse"></div>
                        </div>
                        <div className="h-4 bg-gray-300 rounded w-24 mb-1 animate-pulse"></div>
                        <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {game.videos
                        .slice(0, showAllVideos ? game.videos.length : 4)
                        .map((video) => (
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
                            <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-300">
                              {video.videoThumbnail ? (
                                <img
                                  src={video.videoThumbnail}
                                  alt={video.title || "Video"}
                                  className="object-cover w-full h-full"
                                  onError={(e) => {
                                    // If thumbnail fails to load, show a placeholder
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    const placeholder =
                                      target.nextElementSibling as HTMLElement;
                                    if (placeholder)
                                      placeholder.style.display = "flex";
                                  }}
                                />
                              ) : (
                                <span className="text-xs">No Thumbnail</span>
                              )}
                              <div className="hidden items-center justify-center w-full h-full text-xs text-gray-500">
                                <span>Video Preview</span>
                              </div>
                            </div>
                            <span className="text-sm font-medium truncate w-full text-center">
                              {video.title || "Untitled"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDuration(video.videoDuration || 0)}
                            </span>
                          </Button>
                        ))}
                    </div>
                    {game.videos.length > 4 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowAllVideos(!showAllVideos)}
                        >
                          {showAllVideos
                            ? "Show Less"
                            : `Show More (${game.videos.length - 4})`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right sidebar: Library list */}
            <div className="lg:w-1/4 lg:h-full w-full h-auto border-l py-4 px-2 lg:overflow-y-auto bg-transparent">
              <Card className="border px-2 bg-[#858585] gap-1">
                <h2 className="text-lg font-semibold mb-0 bg-[#858585]">
                  {game.name}
                </h2>
                <CardContent className="p-0">
                  {!game.videos || game.videos.length === 0 ? (
                    // Skeleton loading for video list when no videos are available
                    <div className="space-y-1">
                      {[...Array(4)].map((_, index) => (
                        <div
                          key={index}
                          className="px-0 text-[0.85rem] rounded flex justify-between items-center gap-2"
                        >
                          <div className="flex items-center gap-2 w-[80%]">
                            <div className="w-5 h-5 bg-gray-400 rounded animate-pulse"></div>
                            <div className="h-4 bg-gray-400 rounded w-32 animate-pulse"></div>
                          </div>
                          <div className="h-3 bg-gray-400 rounded w-12 animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ol className="list-none space-y-1 ">
                      {game.videos.map((video) => (
                        <li
                          key={video._id}
                          className={`px-0 text-[0.85rem] hover:bg-[#858585] rounded flex justify-between items-center gap-2 cursor-pointer`}
                          onClick={() => selectVideo(video)}
                        >
                          <div className="flex items-center gap-2 w-[80%] text-wrap whitespace-break-spaces">
                            <div className="w-5 h-5 flex items-center justify-center">
                              {selectedVideo?._id === video._id ? (
                                <CircleCheck className="w-4 h-4 text-black" />
                              ) : (
                                <Circle className="w-4 h-4 text-black" />
                              )}
                            </div>
                            <span className="truncate block">
                              {video.title || "no title"}
                            </span>
                          </div>
                          <span className="text-xs text-gray-700">
                            {formatDuration(video.videoDuration || 0)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Download Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-gray-800">
              Why Download?
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-gray-600 text-lg">
              Save instantly with us for $100 and have all these videos
            </p>
            <Button
              onClick={handleSignupRedirect}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3"
            >
              Sign Up Now!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GameComponent;
