import { PlayCircleIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import Loading from "../shared/loading";
import { convertWebMToMP4, getVideoMetadata } from "../../utils/videoConverter";

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
  onTrimChange?: (start: number, end: number) => void;
  onTrimComplete?: (trimmedBlob: Blob, start: number, end: number) => void;
}

const THUMB_COUNT = 8;
const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 45;

const TrimSliderWithThumbnails: React.FC<TrimSliderWithThumbnailsProps> = ({
  duration,
  videoUrl,
  onTrimChange,
  videoThumbnail,
  onTrimComplete,
}) => {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Responsive thumbnail size
  const [thumbSize, setThumbSize] = useState({
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  });

  // Initialize video element
  useEffect(() => {
    if (!videoUrl) return;

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true; // Must be muted for captureStream to work
    video.playsInline = true;
    video.preload = "metadata";
    
    const handleLoadedMetadata = () => {
      console.log("Video loaded metadata:", {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
      setIsVideoReady(true);
    };

    const handleError = (e: Event) => {
      console.error("Video loading error:", e);
      setIsVideoReady(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.src = videoUrl;
    videoRef.current = video;

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current.removeEventListener('error', handleError);
        videoRef.current.src = "";
        videoRef.current = null;
      }
      setIsVideoReady(false);
    };
  }, [videoUrl]);

  // Generate thumbnails at intervals
  useEffect(() => {
    if (!videoUrl || !duration || !isVideoReady) return;

    const captureThumbnails = async () => {
      const thumbs: string[] = [];
      const interval = duration / (THUMB_COUNT - 1);
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      try {
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
          video.src = videoUrl;
        });

        for (let i = 0; i < THUMB_COUNT; i++) {
          const time = Math.min(duration, Math.round(i * interval));
          video.currentTime = time;
          await new Promise((resolve) => {
            video.onseeked = resolve;
          });
          
          const canvas = document.createElement("canvas");
          const lowQWidth = Math.max(thumbSize.width * 0.5, 32);
          const lowQHeight = Math.max(thumbSize.height * 0.5, 18);
          canvas.width = lowQWidth;
          canvas.height = lowQHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbs.push(canvas.toDataURL("image/jpeg", 0.3));
          }
        }
        setThumbnails(thumbs);
      } catch (error) {
        console.error("Error capturing thumbnails:", error);
        setThumbnails([]);
      }
    };

    captureThumbnails();
  }, [videoUrl, duration, thumbSize, isVideoReady]);

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
      if (onTrimChange) onTrimChange(Math.min(newStart, end - 1), end);
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
      if (onTrimChange) onTrimChange(start, Math.max(newEnd, start + 1));
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

  // Enhanced video trimming with proper stream capture
  const handleTrim = async () => {
    if (!videoRef.current || isTrimming || !isVideoReady) {
      console.error("Cannot trim: video not ready or already trimming");
      return;
    }

    setIsTrimming(true);
    recordedChunksRef.current = [];

    try {
      console.log("Starting video trim:", { start, end, duration: end - start });
      
      // Create canvas for video capture
      const canvas = document.createElement("canvas");
      const video = videoRef.current;
      
      // Set canvas size to match video dimensions
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      canvasRef.current = canvas;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Get stream from canvas
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          console.log("MediaRecorder stopped, chunks:", recordedChunksRef.current.length);
          
          // Convert WebM to MP4 using FFmpeg.wasm or similar
          // For now, we'll use the WebM blob directly
          const webmBlob = new Blob(recordedChunksRef.current, {
            type: "video/webm"
          });
          
          console.log("WebM blob created:", {
            size: webmBlob.size,
            type: webmBlob.type,
            startTime: start,
            endTime: end,
            duration: end - start
          });

                     // Convert WebM to MP4 using enhanced utility function
           const mp4Blob = await handleWebMToMP4Conversion(webmBlob);
          
          if (onTrimComplete) {
            onTrimComplete(mp4Blob, start, end);
          }
        } catch (error) {
          console.error("Error processing recorded video:", error);
        } finally {
          // Clean up
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          setIsTrimming(false);
        }
      };

      // Start recording
      mediaRecorder.start();

      // Seek to start position and wait for it to be ready
      video.currentTime = start;
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });

      // Start drawing frames to canvas
      let startTime = Date.now();
      const drawFrame = () => {
        if (!video || !ctx || !canvas) return;
        
        const currentTime = video.currentTime;
        const elapsed = (Date.now() - startTime) / 1000;
        
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Check if we've reached the end time
        if (currentTime >= end || elapsed >= (end - start)) {
          console.log("Reached end time, stopping recording");
          mediaRecorder.stop();
          return;
        }
        
        // Continue drawing frames
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };

      // Start playing and drawing
      await video.play();
      drawFrame();
      
    } catch (error) {
      console.error("Error trimming video:", error);
      setIsTrimming(false);
    }
  };

  // Enhanced WebM to MP4 conversion using utility function
  const handleWebMToMP4Conversion = async (webmBlob: Blob): Promise<Blob> => {
    try {
      console.log("Converting WebM to MP4 using utility function");
      const convertedBlob = await convertWebMToMP4(webmBlob, {
        quality: 'medium',
        frameRate: 30
      });
      
      // Get metadata to verify conversion
      const metadata = await getVideoMetadata(convertedBlob);
      console.log("Converted video metadata:", metadata);
      
      return convertedBlob;
    } catch (error) {
      console.error("Error converting WebM to MP4:", error);
      // Fallback to original blob
      return webmBlob;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
          className="z-50 bg-[#858585] rounded-none"
          onClick={handleTrim}
        >
          {isTrimming ? (
            <span>
              <Loading size={20} white />
            </span>
          ) : (
            <>
              <PlayCircleIcon size={40} fill="black" color="#858585" />
              <span className="ml-2 text-xs">
                {Math.round(start)}s - {Math.round(end)}s
              </span>
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
              border: "4px solid #878510",
              boxShadow: "0 0 2px #878510",
              transition: "background 0.2s",
              touchAction: "none",
              height: thumbSize.height * 0.6,
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
              height: thumbSize.height * 0.6,
              zIndex: 2,
              cursor: "ew-resize",
              background: "white",
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
              height: thumbSize.height * 0.6,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TrimSliderWithThumbnails;
