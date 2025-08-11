"use client";

import { Calendar, CircleCheck, FolderOpen, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getVideoDetails } from "@/app/api/peertube/api";
import Navbar from "@/components/Home/Navbar";
import Loading from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import Hls from "hls.js";

const initialVideoDetails = {
  id: "",
  name: "",
  description: "",
  duration: 0,
  publishedAt: "",
  account: {
    displayName: "",
  },
  streamingPlaylists: [
    {
      quality: "",
      playlistUrl: "",
    },
  ],
  thumbnailPath: "",
};

const ShareVideoPage = () => {
  const searchParams = useSearchParams();
  const shareVideoId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [thumbnail, setThumbnail] = useState("");
  const [videoDetails, setVideoDetails] = useState<
    typeof initialVideoDetails | null
  >(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // * getting video details
  const fetchVideoDetails = async (shareVideoId: string) => {
    if (!shareVideoId) {
      setError("No video ID provided. Please check the link and try again.");
      setIsLoading(false);
      return;
    } else {
      try {
        setIsLoading(true);
        const res = await getVideoDetails(shareVideoId);

        if (
          res.success &&
          res.data &&
          typeof res.data === "object" &&
          "thumbnailPath" in res.data
        ) {
          setVideoDetails(res.data as typeof initialVideoDetails);
          setThumbnail(
            `${
              process.env.PEERTUBE_VIDEO_URL ||
              "https://video.visiononline.games"
            }${(res.data as { thumbnailPath: string }).thumbnailPath}` || ""
          );
          // Simulate view count for demo
          setViewCount(Math.floor(Math.random() * 10000) + 1000);
        } else {
          console.error("Error fetching video details:", res.message);
          setError(
            "Failed to fetch video details. Please check the video ID and try again."
          );
          toast.error("Failed to fetch video details");
        }
      } catch (error) {
        console.log("🚀 ~ fetchVideoDetails ~ error:", error);
        setError(
          "Network error occurred. Please check your connection and try again."
        );
        toast.error("Please try again later");
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (shareVideoId) {
      fetchVideoDetails(shareVideoId);
    }
  }, [shareVideoId]);

  useEffect(() => {
    if (!videoDetails || !videoRef.current) return;

    const video = videoRef.current;
    let hls: Hls;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(videoDetails.streamingPlaylists[0].playlistUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsVideoLoading(false);
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
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // For Safari
      video.src = videoDetails.streamingPlaylists[0].playlistUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsVideoLoading(false);
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoDetails]);

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

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error || !videoDetails) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <Card className="p-8 text-center max-w-md mx-4">
            <CardContent>
              <div className="text-6xl mb-4">📹</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {error ? "Error Loading Video" : "Video Not Found"}
              </h2>
              <p className="text-gray-600 mb-6">
                {error ||
                  "The video you're looking for doesn't exist or has been removed."}
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
                  <li>• Check if the video link is correct</li>
                  <li>• Verify your internet connection</li>
                  <li>• The video may have been deleted</li>
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
      <div className="min-h-screen bg-transparent">
        <div className="container mx-auto px-2 lg:px-4 py-4">
          <div className="flex lg:flex-row flex-col justify-start items-start gap-2 lg:h-full h-auto bg-transparent">
            {/* Left sidebar: Season/Game info */}
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
                          Season/Game
                        </CardTitle>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[0.7rem] text-black/80">
                        <span className="flex items-center gap-1">
                          <Video className="w-3 h-3" />1 Video
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {videoDetails.publishedAt
                            ? new Date(
                                videoDetails.publishedAt
                              ).toLocaleDateString()
                            : "N/A"}
                        </span>
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />
                          Sports
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle: Video player and chapters */}
            <div className="flex-1 flex flex-col lg:h-full w-full h-auto">
              <div className="flex-1 p-0 border-b aspect-video bg-black rounded">
                <div className="h-full w-full relative">
                  {isVideoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={videoDetails.name}
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
                    poster={thumbnail}
                    onError={() => {
                      setIsVideoLoading(false);
                      toast.error("Failed to load video");
                    }}
                  />
                </div>
              </div>

              {/* Chapters grid below player */}
              <div className="h-auto p-4 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="secondary"
                    className="flex flex-col items-center h-auto p-1"
                  >
                    <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-300">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={videoDetails.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-xs">No Thumbnail</span>
                      )}
                    </div>
                    <span className="text-sm font-medium truncate w-full text-center">
                      {videoDetails.name || "Untitled"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDuration(videoDetails.duration)}
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right sidebar: Video name */}
            <div className="lg:w-1/4 lg:h-full w-full h-auto border-l py-4 px-2 lg:overflow-y-auto bg-transparent">
              <Card className="border px-2 bg-[#858585] gap-1">
                <h2 className="text-lg font-semibold mb-0 bg-[#858585]">
                  Video
                </h2>
                <CardContent className="p-0">
                  <ol className="list-none space-y-1">
                    <li className="px-0 text-[0.85rem] hover:bg-[#858585] rounded flex justify-between items-center gap-2 cursor-pointer">
                      <div className="flex items-center gap-2 w-[80%] text-wrap whitespace-break-spaces">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <CircleCheck className="w-4 h-4 text-black" />
                        </div>
                        <span className="truncate block">
                          {videoDetails.name || "no title"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-700">
                        {formatDuration(videoDetails.duration)}
                      </span>
                    </li>
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

export default ShareVideoPage;
