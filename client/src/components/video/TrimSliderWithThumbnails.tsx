import { PlayCircleIcon, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";

interface TrimSliderWithThumbnailsProps {
  duration: number;
  videoUrl: string;
  videoThumbnail: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  onTrimComplete?: (
    trimmedBlob: Blob,
    start: number,
    end: number
  ) => Promise<void>;
}

const THUMB_COUNT = 8;
const MIN_TRIM_DURATION = 1; // seconds
const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 45;

const TrimSliderWithThumbnails: React.FC<TrimSliderWithThumbnailsProps> = ({
  duration,
  videoUrl,
  videoRef,
  videoThumbnail,
  onTrimComplete,
}) => {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [status, setStatus] = useState<{
    phase: "idle" | "generating-thumbs" | "trimming" | "error";
    message?: string;
  }>({ phase: "idle" });

  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragType = useRef<"start" | "end">("start");

  // Generate thumbnails
  useEffect(() => {
    if (!videoUrl || !duration || !videoRef.current) return;

    // Update your thumbnail generation code with these changes:

    const captureThumbnails = async () => {
      setStatus({
        phase: "generating-thumbs",
        message: "Generating preview...",
      });
      const thumbs: string[] = [];
      const interval = duration / (THUMB_COUNT - 1);

      try {
        // Create a new video element with CORS enabled
        const video = document.createElement("video");
        video.crossOrigin = "anonymous"; // This is crucial
        video.src = videoUrl + "?crossorigin"; // Some servers need this

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          video.addEventListener("loadedmetadata", () => resolve());
          video.addEventListener("error", (err) => reject(err));
          video.load();
        });

        // Create a canvas for capturing frames
        const canvas = document.createElement("canvas");
        canvas.width = THUMB_WIDTH;
        canvas.height = THUMB_HEIGHT;
        const ctx = canvas.getContext("2d");

        if (!ctx) throw new Error("Could not get canvas context");

        for (let i = 0; i < THUMB_COUNT; i++) {
          const time = Math.min(duration, i * interval);
          video.currentTime = time;

          await new Promise<void>((resolve) => {
            video.addEventListener("seeked", () => resolve(), { once: true });
          });

          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Add error handling for tainted canvas
            let thumbnailUrl;
            try {
              thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7);
            } catch (error) {
              // Fallback to a placeholder if we can't export the canvas
              console.warn(
                "Could not export canvas, using placeholder:",
                error
              );
              ctx.fillStyle = "#ddd";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = "#888";
              ctx.font = "12px Arial";
              ctx.fillText(`${formatTime(time)}`, 10, 20);
              thumbnailUrl = canvas.toDataURL();
            }

            thumbs.push(thumbnailUrl);
          } catch (drawError) {
            console.warn("Error drawing video frame:", drawError);
            // Push a placeholder if we can't draw this frame
            ctx.fillStyle = "#ddd";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#888";
            ctx.font = "12px Arial";
            ctx.fillText(`${formatTime(time)}`, 10, 20);
            thumbs.push(canvas.toDataURL());
          }
        }

        setThumbnails(thumbs);
        setStatus({ phase: "idle" });
      } catch (error) {
        console.error("Error generating thumbnails:", error);
        setStatus({ phase: "error", message: "Failed to generate preview" });

        // Create placeholder thumbnails if generation fails completely
        const placeholderThumbs = Array(THUMB_COUNT)
          .fill("")
          .map((_, i) => {
            const canvas = document.createElement("canvas");
            canvas.width = THUMB_WIDTH;
            canvas.height = THUMB_HEIGHT;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ddd";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = "#888";
              ctx.font = "12px Arial";
              ctx.fillText(`Thumb ${i + 1}`, 10, 20);
            }
            return canvas.toDataURL();
          });
        setThumbnails(placeholderThumbs);
      }
    };

    captureThumbnails();
  }, [videoUrl, duration, videoRef]);

  // Handle slider drag
  const handleDragStart =
    (type: "start" | "end") => (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      isDragging.current = true;
      dragType.current = type;

      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", handleDragEnd);
      document.addEventListener("touchmove", handleDrag);
      document.addEventListener("touchend", handleDragEnd);
    };

  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.current || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));

    if (dragType.current === "start") {
      const newStart = percent * duration;
      setStart(Math.min(newStart, end - MIN_TRIM_DURATION));

      // Auto-play from new start position
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
        videoRef.current.play().catch(console.error);
      }
    } else {
      const newEnd = percent * duration;
      setEnd(Math.max(newEnd, start + MIN_TRIM_DURATION));
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDrag);
    document.removeEventListener("touchend", handleDragEnd);

    // Pause video when dragging ends
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Trim the video
  const handleTrim = async () => {
    if (!videoRef.current || !onTrimComplete || end - start < MIN_TRIM_DURATION)
      return;

    setStatus({ phase: "trimming", message: "Processing video..." });

    try {
      const stream = await captureVideoStream();
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      await new Promise<void>((resolve, reject) => {
        mediaRecorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: "video/webm" });
            await onTrimComplete(blob, start, end);
            setStatus({ phase: "idle" });
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        mediaRecorder.start();
        videoRef.current.currentTime = start;

        videoRef.current.onseeked = () => {
          videoRef.current?.play();

          const checkEnd = () => {
            if (videoRef.current && videoRef.current.currentTime >= end) {
              mediaRecorder.stop();
              stream.getTracks().forEach((track) => track.stop());
            } else {
              requestAnimationFrame(checkEnd);
            }
          };

          checkEnd();
        };
      });
    } catch (error) {
      console.error("Error trimming video:", error);
      setStatus({ phase: "error", message: "Failed to trim video" });
    }
  };

  // Helper to capture video stream
  const captureVideoStream = async (): Promise<MediaStream> => {
    if (!videoRef.current) throw new Error("Video element not available");

    if ("captureStream" in videoRef.current) {
      return (videoRef.current as any).captureStream();
    }

    // Fallback for browsers without captureStream
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    const stream = canvas.captureStream();
    const drawFrame = () => {
      if (videoRef.current && ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      }
    };
    drawFrame();
    return stream;
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Time display */}
      <div className="w-full flex justify-between mb-1 text-sm">
        <span>{formatTime(start)}</span>
        <span>
          {formatTime(end - start)} / {formatTime(duration)}
        </span>
        <span>{formatTime(end)}</span>
      </div>

      {/* Slider with trim button */}
      <div
        className="relative w-full flex items-center gap-2 select-none"
        style={{ height: "auto", maxWidth: "95%", width: "95%" }}
        ref={sliderRef}
      >
        <Button
          size="default"
          variant="secondary"
          disabled={status.phase !== "idle" || end - start < MIN_TRIM_DURATION}
          className="z-50 bg-[#858585] rounded-none"
          onClick={handleTrim}
        >
          {status.phase === "trimming" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <PlayCircleIcon size={40} fill="black" color="#858585" />
          )}
        </Button>

        <div
          className="relative flex-1 flex items-center"
          style={{ height: THUMB_HEIGHT + 8 }}
        >
          {/* Thumbnails track as a single image strip */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex w-full pointer-events-none"
            style={{ minWidth: 0, height: THUMB_HEIGHT * 0.6 }}
          >
            {status.phase === "generating-thumbs" || status.phase === "error"
              ? Array.from({ length: THUMB_COUNT }).map((_, i) => (
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
                ))
              : thumbnails.map((thumb, i) => (
                  <img
                    key={i}
                    src={thumb}
                    alt={`Video thumbnail ${i + 1}`}
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
              height: THUMB_HEIGHT * 0.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={handleDragStart("start")}
            onTouchStart={handleDragStart("start")}
          />

          {/* End handle */}
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
              height: THUMB_HEIGHT * 0.6,
              zIndex: 2,
              cursor: "ew-resize",
              background: "white",
              border: "4px solid #878510",
              boxShadow: "0 0 2px #878510",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={handleDragStart("end")}
            onTouchStart={handleDragStart("end")}
          />

          {/* Highlighted selection */}
          <div
            className="absolute top-1/2 -translate-y-1/2 bg-blue-200/50 opacity-30 pointer-events-none"
            style={{
              left: `${(start / duration) * 100}%`,
              width: `${((end - start) / duration) * 100}%`,
              zIndex: 1,
              borderRadius: 8,
              height: THUMB_HEIGHT * 0.6,
            }}
          />
        </div>
      </div>

      {/* Status message */}
      {status.phase === "error" && (
        <div className="text-red-600 text-sm mt-1">{status.message}</div>
      )}
    </div>
  );
};

export default TrimSliderWithThumbnails;
