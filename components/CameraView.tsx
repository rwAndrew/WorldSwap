
import React, { useRef, useState, useEffect } from 'react';

interface CameraViewProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setHasCamera(false);
      }
    }
    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg');
        onCapture(data);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onCapture(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4 animate-scale-in">
      <div className="relative w-full max-w-md aspect-[9/16] rounded-[2.5rem] overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
        {hasCamera ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-10">
              <button 
                onClick={onCancel}
                className="w-14 h-14 rounded-full glass flex items-center justify-center text-white text-lg transition-transform hover:scale-110 active:scale-90"
              >
                ✕
              </button>
              <button 
                onClick={takePhoto}
                className="w-24 h-24 rounded-full border-4 border-white/30 bg-transparent flex items-center justify-center p-2 group"
              >
                <div className="w-full h-full bg-white rounded-full group-hover:scale-95 transition-transform" />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-full glass flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-90"
              >
                <span className="text-2xl">🖼️</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-8">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center text-3xl">📷</div>
            <p className="text-zinc-400 font-medium">Camera access is required for real-time exchange.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-white text-black rounded-3xl font-black text-sm tracking-widest uppercase shadow-xl active:scale-95 transition-transform"
            >
              Open Gallery
            </button>
            <button onClick={onCancel} className="text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">Go Back</button>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraView;
