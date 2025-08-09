import { CircleX, Download } from "lucide-react";
import React from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { NEXT_PUBLIC_BASE_URL } from "@/lib/data";

interface ShareVideoModalProps {
  setShareModal: (value: boolean) => void;
  shareVideoId: string;
}

const ShareVideoModal: React.FC<ShareVideoModalProps> = ({
  setShareModal,
  shareVideoId,
}) => {
  // Construct the full video link
  const videoLink = `${
    process.env.NEXT_PUBLIC_BASE_URL || "http://142.171.232.171:3000"
  }/${shareVideoId}`;
  console.log("🚀 ~ ShareVideoModal ~ videoLink:", videoLink);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(videoLink);
        toast.success("Copied to clipboard!");
      } else {
        // fallback for insecure context or unsupported clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = videoLink;
        // Avoid scrolling to bottom
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand("copy");
          if (successful) {
            toast.success("Copied to clipboard!");
          } else {
            throw new Error();
          }
        } catch {
          toast.error("Failed to copy link");
        }
        document.body.removeChild(textArea);
      }
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // Ref for QRCode SVG
  const qrRef = React.useRef<HTMLDivElement>(null);

  // Save QR code as PNG
  const handleSaveQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return toast.error("QR code not found");
    // Create canvas
    const canvas = document.createElement("canvas");
    const size = window.innerWidth < 640 ? 120 : 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return toast.error("Canvas error");
    // Serialize SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new window.Image();
    img.onload = function () {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "video-qr-code.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR code saved!");
    };
    img.onerror = function () {
      toast.error("Failed to save QR code");
    };
    img.src =
      "data:image/svg+xml;base64," +
      window.btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 bg-black/10 z-50 flex items-center justify-center p-2">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 w-full max-w-xs sm:max-w-md md:max-w-lg transition-all">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-lg sm:text-xl font-semibold">Share Video</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShareModal(false)}
            className="rounded-full"
          >
            <CircleX className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-2 ">
          {/* * video link */}
          <div className="w-full">
            <p className="text-xs sm:text-sm font-bold text-primary  mb-2">
              Video Link
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md truncate text-xs sm:text-sm">
                {videoLink}
              </div>
              <Button
                // variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                Copy
                {/* <Copy className="h-4 w-4 ml-1" /> */}
              </Button>
            </div>
          </div>

          {/* * QR code */}
          <div className="w-full flex flex-col items-center gap-2 p-2 sm:p-4 bg-white rounded-lg border border-gray-200">
            <div ref={qrRef} className="flex justify-center">
              <QRCode
                value={videoLink}
                size={window.innerWidth < 640 ? 120 : 200}
                level="H"
              />
            </div>
            <Button
              className="w-full mt-2"
              variant="outline"
              onClick={handleSaveQR}
            >
              Save QR Code
              <Download className="h-4 w-4" />
            </Button>
          </div>

          <Button className="w-full mt-2" onClick={() => setShareModal(false)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShareVideoModal;
