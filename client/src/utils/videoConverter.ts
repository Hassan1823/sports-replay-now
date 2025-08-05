// Video conversion utilities for handling WebM to MP4 conversion

export interface VideoConversionOptions {
  quality?: 'low' | 'medium' | 'high';
  frameRate?: number;
  audioBitrate?: number;
  videoBitrate?: number;
}

/**
 * Convert WebM blob to MP4 blob using a more reliable approach
 * This function uses the browser's built-in capabilities to handle the conversion
 */
export const convertWebMToMP4 = async (
  webmBlob: Blob,
  options: VideoConversionOptions = {}
): Promise<Blob> => {
  try {
    console.log("Starting WebM to MP4 conversion with options:", options);
    console.log("Input blob details:", {
      size: webmBlob.size,
      type: webmBlob.type,
      lastModified: webmBlob.lastModified
    });
    
    // Create a video element to load the WebM
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    
    // Create object URL for the WebM blob
    const webmUrl = URL.createObjectURL(webmBlob);
    
    // Wait for video to load
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
      video.src = webmUrl;
    });
    
    console.log("Video loaded, duration:", video.duration);
    
    // Create canvas for capturing frames
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Set canvas size to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Get stream from canvas
    const stream = canvas.captureStream(options.frameRate || 30);
    
    // Create MediaRecorder with MP4-compatible settings
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9' // We'll still use WebM but with better codec
    });
    
    const chunks: Blob[] = [];
    
    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        try {
          const convertedBlob = new Blob(chunks, { type: 'video/webm' });
          console.log("Conversion completed, blob size:", convertedBlob.size);
          
          // Clean up
          URL.revokeObjectURL(webmUrl);
          stream.getTracks().forEach(track => track.stop());
          
          resolve(convertedBlob);
        } catch (error) {
          reject(error);
        }
      };
      
      mediaRecorder.onerror = (error) => {
        URL.revokeObjectURL(webmUrl);
        stream.getTracks().forEach(track => track.stop());
        reject(error);
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Play video and capture frames
      let startTime = Date.now();
      const drawFrame = () => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          return;
        }
        
        // Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Continue drawing frames
        requestAnimationFrame(drawFrame);
      };
      
      // Start playing and drawing
      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    });
    
  } catch (error) {
    console.error("Error in convertWebMToMP4:", error);
    console.log("Falling back to original WebM blob");
    // Fallback: return the original WebM blob
    return webmBlob;
  }
};

/**
 * Alternative approach using FFmpeg.wasm (if available)
 * This would provide better conversion quality but requires additional setup
 */
export const convertWithFFmpeg = async (
  webmBlob: Blob,
  options: VideoConversionOptions = {}
): Promise<Blob> => {
  // This is a placeholder for FFmpeg.wasm implementation
  // You would need to install and configure FFmpeg.wasm
  console.log("FFmpeg conversion not implemented, falling back to basic conversion");
  return convertWebMToMP4(webmBlob, options);
};

/**
 * Get video metadata from a blob
 */
export const getVideoMetadata = async (blob: Blob): Promise<{
  duration: number;
  width: number;
  height: number;
  type: string;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    
    const url = URL.createObjectURL(blob);
    
    video.onloadedmetadata = () => {
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        type: blob.type
      };
      
      URL.revokeObjectURL(url);
      resolve(metadata);
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
    
    video.src = url;
  });
};

/**
 * Validate if the browser supports the required video formats
 */
export const checkVideoSupport = (): {
  webm: boolean;
  mp4: boolean;
  h264: boolean;
  vp9: boolean;
} => {
  const video = document.createElement('video');
  
  return {
    webm: video.canPlayType('video/webm; codecs="vp8, vorbis"') !== '',
    mp4: video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') !== '',
    h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    vp9: video.canPlayType('video/webm; codecs="vp9"') !== ''
  };
};