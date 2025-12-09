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
        // Mobile-friendly constraints: use 'ideal' instead of exact values
        // and specify facingMode for mobile devices.
        const constraints = {
            video: { 
                facingMode: 'user', 
                width: { ideal: 320 }, 
                height: { ideal: 240 } 
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video plays on iOS/Mobile
          videoRef.current.play().catch(e => console.error("Video play error:", e));
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        let msg = "摄像头启动失败。";
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = "请允许访问摄像头以进行游戏。";
        } else if (err.name === 'OverconstrainedError') {
            msg = "摄像头不支持当前分辨率。";
        }
        onStatusChange(msg);
      }
    };

    startCamera();

    // Initialize Gemini Service
    const service = new GeminiLiveService({
      onFingerMove: (pos) => {
        // Mirror X because webcam is usually mirrored for the user
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
        
        // Ensure we have data
        if (video.readyState >= 2 && ctx) { // HAVE_CURRENT_DATA or better
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
    <div className="fixed bottom-4 right-4 w-32 h-24 md:w-48 md:h-36 border-2 border-slate-700 rounded-lg overflow-hidden bg-black z-10 shadow-lg transition-all duration-300 opacity-80 hover:opacity-100">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover transform -scale-x-100" // Mirror locally
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute top-0 left-0 bg-black/50 text-[10px] md:text-xs px-2 py-1 text-white">
        摄像头画面
      </div>
    </div>
  );
};