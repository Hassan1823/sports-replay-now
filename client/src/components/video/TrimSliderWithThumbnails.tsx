import { PlayCircleIcon, Clock } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import Loading from "../shared/loading";

interface VideoDetails {
  name?: string;
  title?: string;
  duration?: number;
  muteVideo?: boolean;
  category?: { label?: string };
  thumbnailPath?: string;
  streamingPlaylists?: { files: { fileUrl: string }[] }[];
  [key: string]: unknown;
}

interface TrimSliderWithThumbnailsProps {
  duration: number;
  videoUrl: string;
  videoId?: string;
  videoThumbnail?: string;
  video?: VideoDetails;
  onTrimChange?: (start: number, end: number) => void; // Add this
  onTrimComplete?: (
    trimmedBlob: Blob,
    start: number,
    end: number,
    duration: number
  ) => void;
  onTrimStateChange?: (isTrimming: boolean) => void; // Add this to notify parent of trimming state
}

const THUMB_COUNT = 8;

const THUMB_WIDTH = 80; // px, for mobile
const THUMB_HEIGHT = 45;

const TrimSliderWithThumbnails: React.FC<TrimSliderWithThumbnailsProps> = ({
  duration,
  videoUrl,
  onTrimChange, // Add this
  videoThumbnail,
  onTrimComplete,
  onTrimStateChange,
}) => {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Responsive thumbnail size
  const [thumbSize, setThumbSize] = useState({
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  });

  // Notify parent component when trimming state changes
  useEffect(() => {
    // console.log(
    //   "TrimSliderWithThumbnails: isTrimming state changed to:",
    //   isTrimming
    // );
    if (onTrimStateChange) {
      onTrimStateChange(isTrimming);
    }
  }, [isTrimming, onTrimStateChange]);

  // Initialize video element
  useEffect(() => {
    if (!videoUrl) return;

    setIsVideoReady(false);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    videoRef.current = video;

    // Track when video is ready
    const handleLoadedData = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setIsVideoReady(true);
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", () => setIsVideoReady(false));

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener("loadeddata", handleLoadedData);
        videoRef.current.src = "";
        videoRef.current = null;
      }
    };
  }, [videoUrl]);

  // Generate thumbnails at intervals
  useEffect(() => {
    if (!videoUrl || !duration) return;

    const captureThumbnails = async () => {
      const thumbs: string[] = [];
      const interval = duration / (THUMB_COUNT - 1);
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      for (let i = 0; i < THUMB_COUNT; i++) {
        const time = Math.min(duration, Math.round(i * interval));
        video.currentTime = time;
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
        const canvas = document.createElement("canvas");
        // Use smaller size for low quality thumbnails
        const lowQWidth = Math.max(thumbSize.width * 0.5, 32);
        const lowQHeight = Math.max(thumbSize.height * 0.5, 18);
        canvas.width = lowQWidth;
        canvas.height = lowQHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Use lower quality for JPEG (0.3)
          thumbs.push(canvas.toDataURL("image/jpeg", 0.3));
        }
      }
      setThumbnails(thumbs);
    };

    captureThumbnails();
  }, [videoUrl, duration, thumbSize]);

  // Handle window resize
  useEffect(() => {
    const updateThumbSize = () => {
      if (window.innerWidth < 640) {
        setThumbSize({ width: 60, height: 34 });
      } else if (window.innerWidth < 1024) {
        setThumbSize({ width: 80, height: 45 });
      } else {
        setThumbSize({ width: 120, height: 68 });
      }
    };
    updateThumbSize();
    window.addEventListener("resize", updateThumbSize);
    return () => window.removeEventListener("resize", updateThumbSize);
  }, []);

  // Touch support for handles
  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const slider = (e.target as HTMLElement).parentElement!;
    const getClientX = (evt: MouseEvent | TouchEvent) =>
      "touches" in evt ? evt.touches[0].clientX : (evt as MouseEvent).clientX;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const rect = slider.getBoundingClientRect();
      let percent = (getClientX(moveEvent) - rect.left) / rect.width;
      percent = Math.max(0, Math.min(percent, (end - 1) / duration));
      const newStart = Math.round(percent * duration);
      setStart(Math.min(newStart, end - 1));
      if (onTrimChange) onTrimChange(Math.min(newStart, end - 1), end); // Add this
    };
    const onUp = () => {
      window.removeEventListener(
        "mousemove",
        onMove as EventListenerOrEventListenerObject
      );
      window.removeEventListener(
        "mouseup",
        onUp as EventListenerOrEventListenerObject
      );
      window.removeEventListener(
        "touchmove",
        onMove as EventListenerOrEventListenerObject
      );
      window.removeEventListener(
        "touchend",
        onUp as EventListenerOrEventListenerObject
      );
    };
    window.addEventListener(
      "mousemove",
      onMove as EventListenerOrEventListenerObject
    );
    window.addEventListener(
      "mouseup",
      onUp as EventListenerOrEventListenerObject
    );
    window.addEventListener(
      "touchmove",
      onMove as EventListenerOrEventListenerObject
    );
    window.addEventListener(
      "touchend",
      onUp as EventListenerOrEventListenerObject
    );
  };

  const handleEndDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const slider = (e.target as HTMLElement).parentElement!;
    const getClientX = (evt: MouseEvent | TouchEvent) =>
      "touches" in evt ? evt.touches[0].clientX : (evt as MouseEvent).clientX;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const rect = slider.getBoundingClientRect();
      let percent = (getClientX(moveEvent) - rect.left) / rect.width;
      percent = Math.max((start + 1) / duration, Math.min(percent, 1));
      const newEnd = Math.round(percent * duration);
      setEnd(Math.max(newEnd, start + 1));
      if (onTrimChange) onTrimChange(start, Math.max(newEnd, start + 1)); // Add this
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp as EventListener);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp as EventListener);
    };
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", onUp as EventListener);
    window.addEventListener("touchmove", onMove as EventListener);
    window.addEventListener("touchend", onUp as EventListener);
  };

  // trim video
  const handleTrim = async () => {
    if (!videoRef.current || isTrimming) return;

    setIsTrimming(true);
    recordedChunksRef.current = [];

    // Store a reference to the current video element to prevent null issues
    const currentVideo = videoRef.current;

    // Store original volume and mute state at the beginning
    let originalVolume = 1;
    let originalMuted = false;

    if (currentVideo) {
      originalVolume = currentVideo.volume;
      originalMuted = currentVideo.muted;
    }

    try {
      // Ensure video is ready before proceeding
      if (currentVideo.readyState < 2) {
        // HAVE_CURRENT_DATA
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video loading timeout"));
          }, 10000); // 10 second timeout

          currentVideo.onloadeddata = () => {
            clearTimeout(timeout);
            resolve(true);
          };

          currentVideo.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Video failed to load"));
          };
        });
      }

      // Set up media recorder
      const stream = await captureVideoStream();

      // Check if stream has tracks before creating MediaRecorder
      if (stream.getTracks().length === 0) {
        throw new Error(
          "No video tracks available. Please ensure the video is fully loaded."
        );
      }

      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/mp4",
        });
        console.log("Trimmed video details:", {
          startTime: start,
          endTime: end,
          duration: end - start,
          blobSize: blob.size,
          blobType: blob.type,
        });

        const duration = end - start;
        console.log("🚀 ~ handleTrim ~ duration:", duration);

        if (onTrimComplete) {
          onTrimComplete(blob, start, end, duration);
        }

        // Restore original volume and mute state
        if (currentVideo) {
          currentVideo.volume = originalVolume;
          currentVideo.muted = originalMuted;
        }

        // Clean up
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsTrimming(false);
      };

      // Start recording
      mediaRecorderRef.current.start();

      // Seek to start position
      if (!currentVideo) {
        throw new Error("Video element was lost during trimming setup");
      }

      // Mute the video during trimming to prevent audio playback
      currentVideo.volume = 0;
      currentVideo.muted = true;

      currentVideo.currentTime = start;
      await new Promise((resolve) => {
        if (!currentVideo) {
          resolve(true);
          return;
        }
        currentVideo.onseeked = resolve;
      });

      // Play the video to record the selected segment
      if (!currentVideo) {
        throw new Error("Video element was lost before playback");
      }

      currentVideo.play();

      // Stop recording when we reach the end time
      const checkTime = () => {
        if (!currentVideo) {
          // Video element is null, stop recording and cleanup
          mediaRecorderRef.current?.stop();
          return;
        }

        if (currentVideo.currentTime >= end) {
          currentVideo.pause();
          mediaRecorderRef.current?.stop();
        } else {
          requestAnimationFrame(checkTime);
        }
      };

      checkTime();
    } catch (error) {
      console.error("Error trimming video:", error);
      setIsTrimming(false);

      // Restore original volume and mute state on error
      if (currentVideo) {
        currentVideo.volume = originalVolume;
        currentVideo.muted = originalMuted;
      }

      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes("No video tracks available")) {
          alert("Please wait for the video to fully load before trimming.");
        } else if (error.message.includes("Video loading timeout")) {
          alert("Video is taking too long to load. Please try again.");
        } else {
          alert(`Trimming failed: ${error.message}`);
        }
      }
    }
  };

  const captureVideoStream = async (): Promise<MediaStream> => {
    if (!videoRef.current) {
      throw new Error("Video element not initialized");
    }

    // Check if video has valid dimensions
    if (
      videoRef.current.videoWidth === 0 ||
      videoRef.current.videoHeight === 0
    ) {
      throw new Error(
        "Video dimensions are not available. Please wait for the video to load."
      );
    }

    // For browsers that support captureStream
    if ("captureStream" in videoRef.current) {
      // Extend the type to include captureStream
      const stream = (
        videoRef.current as HTMLVideoElement & {
          captureStream?: () => MediaStream;
        }
      ).captureStream!();

      // Verify the stream has tracks
      if (stream.getTracks().length === 0) {
        throw new Error("No video tracks available in capture stream.");
      }

      return stream;
    }

    // Fallback for browsers that don't support captureStream
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    const stream = canvas.captureStream();

    // Verify the canvas stream has tracks
    if (stream.getTracks().length === 0) {
      throw new Error("No video tracks available in canvas stream.");
    }

    const drawFrame = () => {
      if (videoRef.current && ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return stream;
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Range slider */}
      <div
        className="relative w-full flex items-center gap-2 select-none"
        style={{ height: "auto", maxWidth: "95%", width: "95%" }}
      >
        <Button
          size="default"
          variant="secondary"
          disabled={end <= start || isTrimming || !isVideoReady}
          className="z-50 bg-[#858585] rounded-none disabled:cursor-not-allowed"
          onClick={handleTrim}
        >
          {isTrimming ? (
            <span>
              <Loading size={20} white />
            </span>
          ) : !isVideoReady ? (
            <>
              <Clock size={40} />
            </>
          ) : (
            <>
              <PlayCircleIcon size={40} fill="black" color="#858585" />
            </>
          )}
        </Button>
        <div
          className="relative flex-1 flex items-center"
          style={{ height: thumbSize.height + 8 }}
        >
          {/* Thumbnails as slider track */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex w-full pointer-events-none space-x-0"
            style={{
              minWidth: 0,
            }}
          >
            {thumbnails.length === THUMB_COUNT
              ? thumbnails.map((thumb, idx) => (
                  <img
                    key={idx}
                    src={thumb}
                    alt={`thumb-slider-${idx}`}
                    className="border-e-2 border-[#878510] object-cover"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: thumbSize.width,
                      height: thumbSize.height * 0.6,
                      opacity:
                        start <= (idx * duration) / (THUMB_COUNT - 1) &&
                        end >= (idx * duration) / (THUMB_COUNT - 1)
                          ? 1
                          : 0.5,
                      zIndex: 1,
                      maxWidth: "100%",
                      maxHeight: "100%",
                    }}
                    draggable={false}
                  />
                ))
              : Array.from({ length: THUMB_COUNT }).map((_, i) => (
                  <img
                    key={i}
                    src={videoThumbnail}
                    alt={`Video thumbnail fallback ${i + 1}`}
                    style={{
                      width: `calc(100% / ${THUMB_COUNT})`,
                      height: THUMB_HEIGHT * 0.6,
                      objectFit: "cover",
                      borderRadius: 4,
                      opacity: 1,
                      zIndex: 1,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                    draggable={false}
                  />
                ))}
          </div>
          {/* Handles */}
          {/* Start handle */}
          <div
            role="slider"
            tabIndex={0}
            aria-valuenow={start}
            aria-valuemin={0}
            aria-valuemax={end - 1}
            style={{
              position: "absolute",
              left: `${(start / duration) * 100}%`,
              top: "50%",
              width: 16,
              zIndex: 2,
              cursor: "ew-resize",
              transform: "translate(-50%, -50%)",
              background: "white",
              // borderRadius: 8,
              border: "4px solid #878510",
              boxShadow: "0 0 2px #878510",
              transition: "background 0.2s",
              touchAction: "none",
              height: thumbSize.height * 0.6, // match the thumbnail height
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
          />
          <div
            role="slider"
            tabIndex={0}
            aria-valuenow={end}
            aria-valuemin={start + 1}
            aria-valuemax={duration}
            style={{
              position: "absolute",
              left: `${(end / duration) * 100}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 16,
              height: thumbSize.height * 0.6, // match the thumbnail height
              zIndex: 2,
              cursor: "ew-resize",
              background: "white",
              // borderRadius: 8,
              border: "4px solid #878510",
              boxShadow: "0 0 2px #878510",
              transition: "background 0.2s",
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={handleEndDrag}
            onTouchStart={handleEndDrag}
          />
          {/* Highlighted selection */}
          <div
            className="absolute top-1/2 -translate-y-1/2 bg-blue-200/50 opacity-30 pointer-events-none"
            style={{
              left: `${(start / duration) * 100}%`,
              width: `${((end - start) / duration) * 100}%`,
              zIndex: 1,
              borderRadius: 8,
              height: thumbSize.height * 0.6, // match the thumbnail height
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TrimSliderWithThumbnails;

// ****************************************
