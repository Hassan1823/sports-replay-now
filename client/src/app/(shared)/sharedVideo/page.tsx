"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Share2,
  Play,
  Clock,
  Calendar,
  User,
  Eye,
  Heart,
  MessageCircle,
  Download,
} from "lucide-react";

import Loading from "@/components/shared/loading";
import Hls from "hls.js";
import { getVideoDetails } from "@/app/api/peertube/api";
import Navbar from "@/components/Home/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: videoDetails?.name || "Check out this video",
          text: videoDetails?.description || "Amazing sports content",
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Video Section */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden shadow-xl">
                <div className="relative pt-[56.25%] bg-black">
                  {isVideoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img
                        src={thumbnail}
                        alt={videoDetails.name}
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
                    poster={thumbnail}
                    onError={() => {
                      setIsVideoLoading(false);
                      toast.error("Failed to load video");
                    }}
                  />
                </div>

                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {videoDetails.name}
                      </h1>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>{formatViewCount(viewCount)} views</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(
                              videoDetails.publishedAt
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(videoDetails.duration)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3 mb-6">
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
                      className="flex items-center space-x-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Comment</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShare}
                      className="flex items-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </Button>
                  </div>

                  {/* Video Description */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {videoDetails.account.displayName}
                        </p>
                        <p className="text-sm text-gray-600">Content Creator</p>
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {videoDetails.description}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Sports</Badge>
                    <Badge variant="secondary">Replay</Badge>
                    <Badge variant="secondary">Highlights</Badge>
                    <Badge variant="secondary">Action</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Video Stats
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Views</span>
                      <span className="font-medium">
                        {formatViewCount(viewCount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-medium">
                        {formatDuration(videoDetails.duration)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quality</span>
                      <span className="font-medium">
                        {videoDetails.streamingPlaylists[0].quality || "HD"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Related Videos */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    More Videos
                  </h3>
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="flex space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      >
                        <div className="w-20 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Play className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            Related Video {item}
                          </p>
                          <p className="text-xs text-gray-600">
                            2.5K views • 2 days ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Share Section */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Share This Video
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
                      Share this amazing sports content with your friends!
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

export default ShareVideoPage;
