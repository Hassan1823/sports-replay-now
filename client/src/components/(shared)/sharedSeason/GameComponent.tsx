"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Share2,
  Play,
  Clock,
  Calendar,
  Eye,
  Heart,
  Video,
  Gamepad2,
  Users,
} from "lucide-react";

import Loading from "@/components/shared/loading";
import Hls from "hls.js";
import { getGameDetails, getVideoDetails } from "@/app/api/peertube/api";
import Navbar from "@/components/Home/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  streamingPlaylists?: { files: { fileUrl: string }[] }[];
  [key: string]: unknown;
};

const GameComponent = () => {
  const searchParams = useSearchParams();
  const shareGameId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);

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
  console.log("🚀 ~ GameComponent ~ currentPlaybackTime:", currentPlaybackTime);

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

      const gameData = gameRes.data as Game;
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

        // Simulate view count for demo
        setViewCount(Math.floor(Math.random() * 10000) + 1000);
      } else {
        setSelectedVideoDetails(null);
        toast.error("Failed to load video details");
      }
    } catch (error) {
      console.error("Error fetching video details:", error);
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
  // const formatDuration = (seconds: number) => {
  //   const hours = Math.floor(seconds / 3600);
  //   const minutes = Math.floor((seconds % 3600) / 60);
  //   const secs = seconds % 60;

  //   if (hours > 0) {
  //     return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
  //       .toString()
  //       .padStart(2, "0")}`;
  //   }
  //   return `${minutes}:${secs.toString().padStart(2, "0")}`;
  // };

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
          videoRef.current.src = videoSrc;
          videoRef.current.addEventListener("loadedmetadata", () => {
            setIsVideoLoading(false);
          });
        }
      } else if (videoSrc) {
        if (hlsInstance.current) {
          hlsInstance.current.destroy();
          hlsInstance.current = null;
        }
        videoRef.current.src = videoSrc;
        setIsVideoLoading(false);
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

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !game) {
    return (
      <>
        <Navbar />
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
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Section */}
            <div className="lg:col-span-2">
              {/* Game Header */}
              <Card className="mb-6 overflow-hidden shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Gamepad2 className="w-8 h-8 text-green-500" />
                        <h1 className="text-3xl font-bold text-gray-900">
                          {game.name}
                        </h1>
                      </div>
                      <p className="text-gray-600 mb-4">{game.description}</p>
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Video className="w-4 h-4" />
                          <span>{game.totalVideos} Videos</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {game.createdAt
                              ? new Date(game.createdAt).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                        {game.seasonName && (
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{game.seasonName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3">
                    <Button
                      variant={isLiked ? "default" : "outline"}
                      onClick={() => setIsLiked(!isLiked)}
                      className="flex items-center space-x-2"
                    >
                      <Heart
                        className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`}
                      />
                      <span>{isLiked ? "Liked" : "Like"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShare}
                      className="flex items-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Video Player */}
              {selectedVideo ? (
                <Card className="mb-6 overflow-hidden shadow-xl">
                  <div className="relative pt-[56.25%] bg-black">
                    {isVideoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          src={videoThumbnail}
                          alt={selectedVideo.title || "Video"}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                            <p className="text-white">Loading video...</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-contain"
                      controls
                      autoPlay
                      poster={videoThumbnail}
                      onTimeUpdate={(e) => {
                        setCurrentPlaybackTime(e.currentTarget.currentTime);
                      }}
                      onError={() => {
                        setIsVideoLoading(false);
                        toast.error("Failed to load video");
                      }}
                    />
                  </div>

                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                          {selectedVideo.title || "Untitled Video"}
                        </h2>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                          <div className="flex items-center space-x-1">
                            <Eye className="w-4 h-4" />
                            <span>{formatViewCount(viewCount)} views</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>
                              {selectedVideo.videoDuration || "00:00"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-700 leading-relaxed mb-4">
                      {selectedVideo.description || "No description available"}
                    </p>

                    {/* Video Tags */}
                    {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedVideo.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : game.videos.length === 0 ? (
                <Card className="mb-6 overflow-hidden shadow-xl">
                  <div className="relative pt-[56.25%] bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        No Videos Available
                      </h3>
                      <p className="text-gray-500 mb-4">
                        {`This game doesn't have any videos yet.`}
                      </p>
                      <div className="text-sm text-gray-400">
                        {`Check back later for new content!`}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null}

              {/* Videos Grid */}
              <Card className="overflow-hidden shadow-xl">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Videos in this Game
                  </h3>
                  {game.videos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {game.videos.map((video) => (
                        <Card
                          key={video._id}
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            selectedVideo?._id === video._id
                              ? "ring-2 ring-blue-500"
                              : ""
                          }`}
                          onClick={() => selectVideo(video)}
                        >
                          <div className="relative">
                            <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
                              {video.videoThumbnail ? (
                                <img
                                  src={video.videoThumbnail}
                                  alt={video.title || "Video thumbnail"}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    target.nextElementSibling?.classList.remove(
                                      "hidden"
                                    );
                                  }}
                                />
                              ) : null}
                              <div
                                className={`w-full h-full flex items-center justify-center ${
                                  video.videoThumbnail ? "hidden" : ""
                                }`}
                              >
                                <Play className="w-8 h-8 text-gray-400" />
                              </div>
                              {/* Play indicator overlay */}
                              {selectedVideo?._id === video._id && (
                                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                                    <Play className="w-5 h-5 text-black fill-current" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                              {video.videoDuration || "00:00"}
                            </div>
                          </div>
                          <CardContent className="p-3">
                            <h4 className="font-medium text-gray-900 text-sm line-clamp-2">
                              {video.title || "Untitled"}
                            </h4>
                            {selectedVideo?._id === video._id && (
                              <div className="flex items-center space-x-1 mt-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-blue-600 font-medium">
                                  Now Playing
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-700 mb-2">
                        No Videos Found
                      </h4>
                      <p className="text-gray-500 text-sm">
                        {`This game doesn't have any videos yet.`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Game Stats */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Game Stats
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Videos</span>
                      <span className="font-medium">{game.totalVideos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created</span>
                      <span className="font-medium">
                        {game.createdAt
                          ? new Date(game.createdAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    {game.seasonName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Season</span>
                        <span className="font-medium">{game.seasonName}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Video List */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    All Videos
                  </h3>
                  {game.videos.length > 0 ? (
                    <div className="space-y-3">
                      {game.videos.map((video) => (
                        <div
                          key={video._id}
                          className={`flex space-x-3 cursor-pointer p-2 rounded-lg transition-all duration-200 ${
                            selectedVideo?._id === video._id
                              ? "bg-blue-50 border border-blue-200 shadow-sm"
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => selectVideo(video)}
                        >
                          <div className="w-20 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                            {video.videoThumbnail ? (
                              <img
                                src={video.videoThumbnail}
                                alt={video.title || "Video thumbnail"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  target.nextElementSibling?.classList.remove(
                                    "hidden"
                                  );
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-full h-full bg-gray-200 flex items-center justify-center ${
                                video.videoThumbnail ? "hidden" : ""
                              }`}
                            >
                              <Play className="w-4 h-4 text-gray-500" />
                            </div>
                            {/* Play indicator overlay */}
                            {selectedVideo?._id === video._id && (
                              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                  <Play className="w-3 h-3 text-black fill-current" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                selectedVideo?._id === video._id
                                  ? "text-blue-700"
                                  : "text-gray-900"
                              }`}
                            >
                              {video.title || "Untitled"}
                            </p>
                            <p className="text-xs text-gray-600">
                              {video.videoDuration || "00:00"}
                            </p>
                            {selectedVideo?._id === video._id && (
                              <div className="flex items-center space-x-1 mt-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-blue-600 font-medium">
                                  Now Playing
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        No videos available
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Share Section */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Share This Game
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                    <div className="text-xs text-gray-500 text-center">
                      Share this amazing sports game with your friends!
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GameComponent;
