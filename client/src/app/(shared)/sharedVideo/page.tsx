"use client";

import {
  Calendar,
  CircleCheck,
  FolderOpen,
  Video,
  Download,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getVideoDetails,
  addSharedVideoToLibrary,
  checkVideoOwnership,
} from "@/app/api/peertube/api";
import Navbar from "@/components/Home/Navbar";
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

const initialVideoDetails = {
  id: "",
  name: "",
  description: "",
  duration: 0 as number | string,
  publishedAt: "",
  account: {
    displayName: "",
  },
  fileUrl: "",
  thumbnailPath: "",
};

const ShareVideoPage = () => {
  const searchParams = useSearchParams();
  const shareVideoId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [thumbnail, setThumbnail] = useState("");
  const [videoDetails, setVideoDetails] = useState<
    typeof initialVideoDetails | null
  >(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isVideoOwner, setIsVideoOwner] = useState(false);
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);
  const [isVideoImported, setIsVideoImported] = useState(false);
  const [isCheckingImport, setIsCheckingImport] = useState(false);

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

        console.log("API Response:", res);

        if (res.success && res.data && typeof res.data === "object") {
          // Transform the database response to match expected format
          const videoData = res.data as any;

          const transformedVideoDetails = {
            id: videoData._id || videoData.id || "",
            name: videoData.title || videoData.name || "",
            description: videoData.description || "",
            duration: videoData.videoDuration || videoData.duration || 0,
            publishedAt: videoData.createdAt || videoData.publishedAt || "",
            account: {
              displayName:
                videoData.videoChannel || videoData.account?.displayName || "",
            },
            fileUrl: videoData.fileUrl || "",
            thumbnailPath:
              videoData.videoThumbnail || videoData.thumbnailPath || "",
          };

          setVideoDetails(transformedVideoDetails);

          // Set thumbnail - videoThumbnail already contains the complete URL
          const thumbnailPath = transformedVideoDetails.thumbnailPath;
          if (thumbnailPath) {
            console.log("Setting thumbnail from database:", thumbnailPath);
            setThumbnail(thumbnailPath);
          } else {
            console.log("No thumbnail found, using fallback SVG");
            // Use the same fallback SVG as videoPage
            setThumbnail(
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
          setError(
            "Failed to fetch video details. Please check the video ID and try again."
          );
          toast.error("Failed to fetch video details");
        }
      } catch (error) {
        console.log("🚀 ~ fetchVideoDetails ~ error:", error);
        console.error("Full error object:", error);
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

  // Check video ownership when user is logged in
  useEffect(() => {
    const checkOwnership = async () => {
      if (user && shareVideoId) {
        try {
          setIsCheckingOwnership(true);
          const response = await checkVideoOwnership(shareVideoId);
          if (
            response.success &&
            response.data &&
            typeof response.data === "object"
          ) {
            const data = response.data as { isOwner: boolean };
            setIsVideoOwner(data.isOwner);
          }
        } catch (error) {
          console.error("Failed to check video ownership:", error);
          setIsVideoOwner(false);
        } finally {
          setIsCheckingOwnership(false);
        }
      }
    };

    checkOwnership();
  }, [user, shareVideoId]);

  // Check if video is already imported (this would need a separate API endpoint)
  useEffect(() => {
    const checkIfImported = async () => {
      if (user && shareVideoId && !isVideoOwner) {
        // For now, we'll assume it's not imported
        // In a real implementation, you'd call an API to check if the video exists in user's library
        setIsVideoImported(false);
      }
    };

    checkIfImported();
  }, [user, shareVideoId, isVideoOwner]);

  useEffect(() => {
    if (!videoDetails || !videoRef.current) return;

    const video = videoRef.current;
    let hls: Hls;

    if (videoDetails.fileUrl) {
      const videoSrc = videoDetails.fileUrl;
      console.log("Video source:", videoSrc);

      // Handle HLS streams (.m3u8 files)
      if (videoSrc.endsWith(".m3u8")) {
        console.log("Loading HLS stream:", videoSrc);
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(videoSrc);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("HLS manifest parsed, video loading complete");
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
          console.log("Loading HLS stream in Safari:", videoSrc);
          video.src = videoSrc;
          video.addEventListener("loadedmetadata", () => {
            console.log("Safari video metadata loaded");
            setIsVideoLoading(false);
          });
        }
      }
      // Handle direct video files (mp4, webm, etc.)
      else if (videoSrc) {
        console.log("Setting direct video source:", videoSrc);
        video.src = videoSrc;
        video.addEventListener("loadedmetadata", () => {
          console.log("Direct video metadata loaded");
          setIsVideoLoading(false);
        });
      }
    } else {
      console.log("No fileUrl found in video details");
      console.log("Video details:", videoDetails);
      setIsVideoLoading(false);
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoDetails]);

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

  const formatViewCount = (count: number) => {
    // Ensure count is a valid number
    if (!count || isNaN(count) || count < 0) {
      return "0";
    }

    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleDownloadClick = async () => {
    // Always show the modal instead of trying to download directly
    setShowDownloadModal(true);
  };

  // Function to download all videos (for shared video, this downloads the single video)
  const handleDownloadAllVideos = async () => {
    if (!videoDetails?.fileUrl) {
      toast.error("No video available to download");
      return;
    }

    try {
      // Show loading toast for the download
      const toastId = toast.loading(`Preparing to download video...`);

      // Close the modal
      setShowDownloadModal(false);

      // Update toast to show download progress
      toast.loading(`Downloading ${videoDetails.name || "video"}...`, {
        id: toastId,
      });

      // Use fetch with blob to ensure download behavior
      const response = await fetch(videoDetails.fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Create download link with blob URL
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${videoDetails.name || "video"}.mp4`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL after a short delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);

      // Show completion message
      toast.dismiss(toastId);
      toast.success(
        `Download started for ${
          videoDetails.name || "video"
        }! Check your downloads folder.`
      );
    } catch (error) {
      console.error("Error in download:", error);
      toast.error("Download failed. Please try again.");
    }
  };

  const handleImportVideo = async () => {
    if (!user || !shareVideoId) {
      toast.error("Please log in to import videos");
      return;
    }

    if (isVideoImported) {
      toast.info("Video is already in your library!");
      return;
    }

    try {
      setIsCheckingImport(true);
      toast.loading("Importing video to your library...");
      await addSharedVideoToLibrary(shareVideoId, user._id || "");
      toast.dismiss();
      toast.success(
        "Video imported to your library! Check your 'sharedSeason' folder."
      );
      setIsVideoImported(true);
      setShowDownloadModal(false);
    } catch (error) {
      console.error("Failed to import video:", error);
      toast.dismiss();
      toast.error("Failed to import video. Please try again.");
    } finally {
      setIsCheckingImport(false);
    }
  };

  const handleSignupRedirect = () => {
    // Pass the video ID to the signup page
    const videoId = searchParams.get("id");
    if (videoId) {
      window.location.href = `/signup?sharedVideoId=${videoId}`;
    } else {
      window.location.href = "/signup";
    }
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
                            ? (() => {
                                try {
                                  const date = new Date(
                                    videoDetails.publishedAt
                                  );
                                  return isNaN(date.getTime())
                                    ? "N/A"
                                    : date.toLocaleDateString();
                                } catch {
                                  return "N/A";
                                }
                              })()
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
                  {!videoDetails ? (
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
                        poster={thumbnail}
                        onLoadStart={() => setIsVideoLoading(true)}
                        onCanPlay={() => setIsVideoLoading(false)}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {!videoDetails ? (
                    // Skeleton loading for thumbnail preview
                    <div className="flex flex-col items-center h-auto p-1">
                      <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-200 animate-pulse">
                        <div className="w-full h-full bg-gray-300 animate-pulse"></div>
                      </div>
                      <div className="h-4 bg-gray-300 rounded w-24 mb-1 animate-pulse"></div>
                      <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="flex flex-col items-center h-auto p-1"
                    >
                      <div className="w-full aspect-video mb-2 flex items-center justify-center rounded overflow-hidden bg-gray-300">
                        <img
                          src={thumbnail}
                          alt={videoDetails.name}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            // If thumbnail fails to load, show a placeholder
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const placeholder =
                              target.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.style.display = "flex";
                          }}
                        />
                        <div className="hidden items-center justify-center w-full h-full text-xs text-gray-500">
                          <span>Video Preview</span>
                        </div>
                      </div>
                      <span className="text-sm font-medium truncate w-full text-center">
                        {videoDetails.name || "Untitled"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDuration(videoDetails.duration)}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar: Video name */}
            <div className="lg:w-1/4 lg:h-full w-full h-auto border-l py-4 px-2 lg:overflow-y-auto bg-transparent">
              <Card className="border px-2 bg-[#858585] gap-1">
                <div className="flex items-center justify-between p-2">
                  <h2 className="text-lg font-semibold bg-[#858585]">Video</h2>
                  <Download
                    className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white p-1 rounded cursor-pointer transition-colors"
                    onClick={() => setShowDownloadModal(true)}
                  />
                </div>
                <CardContent className="p-0">
                  {!videoDetails ? (
                    // Skeleton loading for video info
                    <div className="space-y-1">
                      <div className="px-0 text-[0.85rem] rounded flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 w-[80%]">
                          <div className="w-5 h-5 bg-gray-400 rounded animate-pulse"></div>
                          <div className="h-4 bg-gray-400 rounded w-32 animate-pulse"></div>
                        </div>
                        <div className="h-3 bg-gray-400 rounded w-12 animate-pulse"></div>
                      </div>
                    </div>
                  ) : (
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
                        <div className="flex items-center gap-2">
                          <Download
                            className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white p-1 rounded cursor-pointer transition-colors"
                            onClick={handleDownloadClick}
                          />
                        </div>
                      </li>
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
            {/* User Status Header */}

            <p className="text-gray-600 text-lg">
              For $100 have all these videos instantly in your library.
            </p>
            <div className="space-y-3">
              {!user ? (
                // User not logged in - show signup button
                <>
                  <Button
                    onClick={handleSignupRedirect}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3"
                  >
                    Sign Up Now
                  </Button>
                </>
              ) : isCheckingOwnership ? (
                // Checking ownership - show loading button
                <Button
                  disabled
                  className="w-full bg-gray-400 text-white text-lg py-3 cursor-not-allowed"
                >
                  Checking...
                </Button>
              ) : isVideoOwner ? (
                // User owns the video - show owned button
                <Button
                  disabled
                  className="w-full bg-gray-400 text-white text-lg py-3 cursor-not-allowed"
                >
                  Owned
                </Button>
              ) : isVideoImported ? (
                // Video already imported - show imported button
                <Button
                  disabled
                  className="w-full bg-green-400 text-white text-lg py-3 cursor-not-allowed"
                >
                  ✓ Imported
                </Button>
              ) : (
                // User logged in but doesn't own - show import button
                <>
                  <Button
                    onClick={handleImportVideo}
                    disabled={isCheckingImport}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3 disabled:bg-green-400"
                  >
                    {isCheckingImport ? "Importing..." : "Import to Library"}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 text-lg py-3"
                onClick={handleDownloadAllVideos}
              >
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareVideoPage;
