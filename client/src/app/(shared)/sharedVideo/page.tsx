"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import Loading from "@/components/shared/loading";
import Hls from "hls.js";
import { getVideoDetails } from "@/app/api/peertube/api";

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
console.log("🚀 ~ initialVideoDetails:", initialVideoDetails);

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

  // * getting video details
  const fetchVideoDetails = async (shareVideoId: string) => {
    if (!shareVideoId) {
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
        } else {
          console.error("Error fetching video details:", res.message);
          toast.error("Failed to fetch video details");
        }
      } catch (error) {
        console.log("🚀 ~ fetchVideoDetails ~ error:", error);
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

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!videoDetails) {
    return (
      <div className="flex items-center justify-center h-screen">
        Video not found
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="relative pt-[56.25%]">
          {" "}
          {/* 16:9 aspect ratio */}
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <img
                src={thumbnail}
                alt={videoDetails.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <Loading />
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            controls
            autoPlay
            poster={thumbnail}
            onError={() => {
              setIsVideoLoading(false);
              toast.error("Failed to load video");
            }}
          />
        </div>

        <div className="p-4">
          <h1 className="text-xl font-bold">{videoDetails.name}</h1>
          <p className="text-gray-600 mt-2">{videoDetails.description}</p>
          <div className="flex items-center mt-4 text-sm text-gray-500">
            <span>{videoDetails.account.displayName}</span>
            <span className="mx-2">•</span>
            <span>
              {new Date(videoDetails.publishedAt).toLocaleDateString()}
            </span>
            <span className="mx-2">•</span>
            <span>
              {Math.floor(videoDetails.duration / 60)} min{" "}
              {videoDetails.duration % 60} sec
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareVideoPage;
