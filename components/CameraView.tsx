import React, { useRef, useState, useEffect, useCallback } from 'react';

interface CameraViewProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [lastTap, setLastTap] = useState(0);

  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode, 
          width: { ideal: 1080 }, 
          height: { ideal: 1920 } 
        }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setHasCamera(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    }
    setLastTap(now);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // If front camera, flip horizontally for the photo
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.85);
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
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center animate-scale-in">
      <div 
        className="relative w-full h-full md:max-w-md md:h-[80vh] md:rounded-[3rem] overflow-hidden bg-zinc-900 shadow-2xl"
        onClick={handleDoubleTap}
      >
        {hasCamera ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* Double Tap Hint Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="glass px-6 py-3 rounded-full text-white/70 text-sm font-bold tracking-wider tap-hint-fade">
                按兩下切換鏡頭 🔄
              </div>
            </div>

            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-10 px-10">
              <button 
                onClick={onCancel}
                className="w-14 h-14 rounded-full glass flex items-center justify-center text-white transition-all active:scale-90"
              >
                ✕
              </button>
              <button 
                onClick={takePhoto}
                className="w-24 h-24 rounded-full border-4 border-white/40 flex items-center justify-center p-2 group"
              >
                <div className="w-full h-full bg-white rounded-full group-active:scale-90 transition-transform" />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-full glass flex items-center justify-center text-2xl transition-all active:scale-90"
              >
                🖼️
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-8">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center text-3xl">📷</div>
            <p className="text-zinc-400 font-medium">需要相機權限才能進行實時交換。</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-white text-black rounded-3xl font-black text-sm tracking-widest uppercase shadow-xl active:scale-95 transition-transform"
            >
              開啟相簿
            </button>
            <button onClick={onCancel} className="text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-white">返回</button>
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