import React, { useRef, useEffect } from 'react';
import { GeminiLiveService, blobToBase64 } from '../services/geminiLive';
import { FingerPosition } from '../types';

interface WebcamOverlayProps {
  onFingerMove: (pos: FingerPosition) => void;
  onStatusChange: (status: string) => void;
  isGameActive: boolean;
}

const FRAME_RATE = 2; // Frames per second sent to Gemini. Keep low to avoid rate limits/latency buildup.
const JPEG_QUALITY = 0.5;

export const WebcamOverlay: React.FC<WebcamOverlayProps> = ({ 
  onFingerMove, 
  onStatusChange,
  isGameActive 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Offscreen canvas for frame capture
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize Camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240 }, // Low res is fine for finger tracking
            audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        onStatusChange("摄像头权限被拒绝。");
      }
    };

    startCamera();

    // Initialize Gemini Service
    const service = new GeminiLiveService({
      onFingerMove: (pos) => {
        // Mirror X because webcam is usually mirrored
        onFingerMove({ ...pos, x: 1 - pos.x });
      },
      onStatusChange,
      onError: (err) => console.error(err)
    });
    serviceRef.current = service;

    return () => {
      service.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Handle Game Active State toggling connection
  useEffect(() => {
    if (isGameActive) {
      serviceRef.current?.connect();
      
      // Start Frame Streaming
      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !serviceRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
           canvas.width = video.videoWidth;
           canvas.height = video.videoHeight;
           ctx.drawImage(video, 0, 0);
           
           canvas.toBlob(async (blob) => {
             if (blob) {
               const base64 = await blobToBase64(blob);
               serviceRef.current?.sendFrame(base64);
             }
           }, 'image/jpeg', JPEG_QUALITY);
        }
      }, 1000 / FRAME_RATE);

    } else {
      serviceRef.current?.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isGameActive]);

  return (
    <div className="fixed bottom-4 right-4 w-48 h-36 border-2 border-slate-700 rounded-lg overflow-hidden bg-black z-10 shadow-lg">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover transform -scale-x-100" // Mirror locally
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute top-0 left-0 bg-black/50 text-xs px-2 py-1 text-white">
        摄像头画面
      </div>
    </div>
  );
};