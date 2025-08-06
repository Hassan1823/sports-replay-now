"use client";

import {
  Calendar,
  Clock,
  Eye,
  FolderOpen,
  Heart,
  Play,
  Share2,
  Trophy,
  Video,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getGamesForSeason,
  getVideoDetails,
  getVideosForGame,
} from "@/app/api/peertube/api";
import Loading from "@/components/shared/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Hls from "hls.js";

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
  open: boolean;
  selected?: boolean;
};

type Season = {
  id: string;
  name: string;
  games: Game[];
  open: boolean;
  description?: string;
  createdAt?: string;
  totalVideos?: number;
  totalGames?: number;
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
  const shareSeasonId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedVideoDetails, setSelectedVideoDetails] =
    useState<VideoDetails | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  const hlsInstance = useRef<Hls | null>(null);

  // Fetch season details
  const fetchSeasonDetails = async (seasonId: string) => {
    if (!seasonId) {
      setError("No season ID provided. Please check the link and try again.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First, get games for this season
      const gamesRes = await getGamesForSeason(seasonId);
      if (!gamesRes.success || !Array.isArray(gamesRes.data)) {
        setError(
          "Failed to fetch games for this season. The season may not exist or you may not have access."
        );
        return;
      }

      // Get videos for each game
      const gamesWithVideos = await Promise.all(
        gamesRes.data.map(async (game: any) => {
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
        })
      );

      const totalVideos = gamesWithVideos.reduce(
        (sum, game) => sum + game.videos.length,
        0
      );
      const totalGames = gamesWithVideos.length;

      // Create season info from the first game's data (since we can't get season directly)
      const firstGame = gamesRes.data[0];
      const seasonInfo: Season = {
        id: seasonId,
        name: firstGame?.seasonName || `Season ${seasonId.slice(-6)}`, // Use season name from game or fallback
        games: gamesWithVideos,
        open: true,
        description: "Amazing sports season with incredible moments",
        createdAt: firstGame?.createdAt || new Date().toISOString(),
        totalVideos,
        totalGames,
      };

      setSeason(seasonInfo);

      // Auto-select first game and video if available
      if (gamesWithVideos.length > 0) {
        const firstGame = gamesWithVideos[0];
        setSelectedGame(firstGame);

        if (firstGame.videos.length > 0) {
          const firstVideo = firstGame.videos[0];
          setSelectedVideo(firstVideo);
          await fetchVideoDetails(firstVideo._id || "");
        }
      }
    } catch (error) {
      console.error("Error fetching season details:", error);

      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes("Route not found")) {
          setError(
            "Season not found. The season may have been deleted or the link is invalid."
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

  // Handle game selection
  const selectGame = (game: Game) => {
    setSelectedGame(game);
    if (game.videos.length > 0) {
      selectVideo(game.videos[0]);
    } else {
      setSelectedVideo(null);
      setSelectedVideoDetails(null);
    }
  };

  // Share functionality
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: season?.name || "Check out this season",
          text: season?.description || "Amazing sports season",
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
  const formatDuration = (seconds: number) => {
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

  // Load season on mount
  useEffect(() => {
    if (shareSeasonId) {
      fetchSeasonDetails(shareSeasonId);
    }
  }, [shareSeasonId]);

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

  if (error || !season) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <Card className="p-8 text-center max-w-md mx-4">
            <CardContent>
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {error ? "Error Loading Season" : "Season Not Found"}
              </h2>
              <p className="text-gray-600 mb-6">
                {error ||
                  "The season you're looking for doesn't exist or has been removed."}
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
                  <li>• Check if the season link is correct</li>
                  <li>• Verify your internet connection</li>
                  <li>• The season may have been deleted</li>
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Section */}
            <div className="lg:col-span-2">
              {/* Season Header */}
              <Card className="mb-6 overflow-hidden shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        <h1 className="text-3xl font-bold text-gray-900">
                          {season.name}
                        </h1>
                      </div>
                      <p className="text-gray-600 mb-4">{season.description}</p>
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <FolderOpen className="w-4 h-4" />
                          <span>{season.totalGames} Games</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Video className="w-4 h-4" />
                          <span>{season.totalVideos} Videos</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {season.createdAt
                              ? new Date(season.createdAt).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
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
              {selectedVideo && (
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
              )}

              {/* Games Grid */}
              <Card className="overflow-hidden shadow-xl">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Games in this Season
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {season.games.map((game) => (
                      <Card
                        key={game.id}
                        className={`cursor-pointer transition-all hover:shadow-lg ${
                          selectedGame?.id === game.id
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                        onClick={() => selectGame(game)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">
                              {game.name}
                            </h4>
                            <Badge variant="outline">
                              {game.videos.length} videos
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Video className="w-4 h-4" />
                            <span>{game.videos.length} videos</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Season Stats */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Season Stats
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Games</span>
                      <span className="font-medium">{season.totalGames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Videos</span>
                      <span className="font-medium">{season.totalVideos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created</span>
                      <span className="font-medium">
                        {season.createdAt
                          ? new Date(season.createdAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Game Videos */}
              {selectedGame && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {selectedGame.name} Videos
                    </h3>
                    <div className="space-y-3">
                      {selectedGame.videos.map((video) => (
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
                                  // Fallback to placeholder if image fails to load
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
                  </CardContent>
                </Card>
              )}

              {/* Share Section */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Share This Season
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
                      Share this amazing sports season with your friends!
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
