"use client";

import { Calendar, Circle, CircleCheck, FolderOpen, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getGamesForSeason,
  getVideoDetails,
  getVideosForGame,
} from "@/app/api/peertube/api";
import Loading from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
  fileUrl?: string;
  [key: string]: unknown;
};

const SeasonComponent = () => {
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
  const [showAllVideos, setShowAllVideos] = useState(false);

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
        name: firstGame?.seasonName || "Season", // Use season name from game or fallback without suffix
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
      selectedVideoDetails.fileUrl &&
      videoRef.current
    ) {
      const videoSrc = selectedVideoDetails.fileUrl;

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

  if (error || !season || (season && season.games.length === 0)) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <Card className="p-8 text-center max-w-md mx-4">
            <CardContent>
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {error
                  ? "Error Loading Season"
                  : !season
                  ? "Season Not Found"
                  : "No Games Found"}
              </h2>
              <p className="text-gray-600 mb-6">
                {error ||
                  (!season
                    ? "The season you're looking for doesn't exist or has been removed."
                    : "This season has no games yet. Please check back later.")}
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
      <div className="min-h-screen bg-transparent">
        <div className="container mx-auto px-2 lg:px-4 py-4">
          <div className="flex lg:flex-row flex-col justify-start items-start gap-2 lg:h-full h-auto bg-transparent">
            {/* Left sidebar: Season info and games list */}
            <div className="lg:w-1/4 lg:h-full w-full h-auto border-r py-4 px-2 bg-transparent lg:overflow-y-auto">
              <Card
                className="px-0 py-2 my-1 border border-[#454444]"
                style={{ backgroundColor: "rgb(133, 133, 133)" }}
              >
                <CardContent className="px-3 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-sm truncate">
                          {season.name}
                        </CardTitle>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[0.7rem] text-black/80">
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />
                          {season.totalGames} Games
                        </span>
                        <span className="flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          {season.totalVideos} Videos
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {season.createdAt
                            ? new Date(season.createdAt).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    {/* Sharing disabled for season */}
                  </div>
                </CardContent>
              </Card>

              <Card
                className="px-0 py-2 my-1 border border-[#454444]"
                style={{ backgroundColor: "rgb(133, 133, 133)" }}
              >
                <CardContent className="px-3 py-2">
                  <h3 className="text-xs font-semibold text-black mb-2">
                    Games
                  </h3>
                  <div className="space-y-0">
                    {season.games.map((game, idx) => (
                      <div
                        key={game.id}
                        className={`w-full border-t ${
                          idx === 0
                            ? "border-t-transparent"
                            : "border-t-[#454444]"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full py-1 px-1 hover:bg-transparent">
                          <div className="flex items-center space-x-2 flex-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 border-2 border-transparent"
                              style={{
                                backgroundColor:
                                  selectedGame?.id === game.id
                                    ? "rgb(133, 133, 133)"
                                    : "transparent",
                              }}
                              onClick={() => selectGame(game)}
                            >
                              {selectedGame?.id === game.id ? (
                                <CircleCheck className="h-4 w-4 text-black" />
                              ) : (
                                <Circle className="h-4 w-4 text-black" />
                              )}
                            </Button>
                            <span
                              className={`text-sm ${
                                selectedGame?.id === game.id
                                  ? "font-semibold"
                                  : ""
                              }`}
                              onClick={() => selectGame(game)}
                            >
                              {game.name}
                            </span>
                          </div>
                          <div className="text-[0.7rem] text-black/70">
                            {game.videos.length} videos
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle: Video player and chapters */}
            <div className="flex-1 flex flex-col lg:w-flex-1 lg:h-full w-full h-auto">
              <div className="flex-1 p-0 border-b aspect-video bg-black rounded">
                {selectedVideo ? (
                  <div className="h-full w-full relative">
                    {isVideoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {videoThumbnail ? (
                          <img
                            src={videoThumbnail}
                            alt={selectedVideo.title || "Video"}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : null}
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
                      onTimeUpdate={(e) =>
                        setCurrentPlaybackTime(e.currentTarget.currentTime)
                      }
                      onError={() => {
                        setIsVideoLoading(false);
                        toast.error("Failed to load video");
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-200 rounded-lg">
                    <div className="text-center">
                      <div className="w-full h-12 bg-gray-400 rounded mx-auto mb-4"></div>
                      <div className="h-4 bg-gray-400 rounded w-48 mx-auto mb-2"></div>
                      <div className="h-3 bg-gray-400 rounded w-32 mx-auto"></div>
                      <h2 className="text-base font-medium mt-2">No Video</h2>
                    </div>
                  </div>
                )}
              </div>

              {/* Chapters grid below player */}
              <div className="h-auto p-4 overflow-y-auto">
                {selectedGame && selectedGame.videos.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {selectedGame.videos
                        .slice(
                          0,
                          showAllVideos ? selectedGame.videos.length : 4
                        )
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
                        ))}
                    </div>
                    {selectedGame.videos.length > 4 && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowAllVideos(!showAllVideos)}
                        >
                          {showAllVideos
                            ? "Show Less"
                            : `Show More (${selectedGame.videos.length - 4})`}
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
                  {selectedGame ? selectedGame.name : "Library"}
                </h2>
                <CardContent className="p-0">
                  <ol className="list-none space-y-1 ">
                    {!selectedGame || selectedGame.videos.length === 0 ? (
                      <li className="w-full h-auto flex justify-center items-center text-gray-800 py-4">
                        No videos found
                      </li>
                    ) : (
                      selectedGame.videos.map((video) => (
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
                            {video.videoDuration || "00:00"}
                          </span>
                        </li>
                      ))
                    )}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SeasonComponent;
