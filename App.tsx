import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, WorldMoment, UserLocation, Language } from './types';
import { getLocationName, verifyAuthenticity } from './services/geminiService';
import { momentStore, isSupabaseConfigured } from './services/momentStore';
import CameraView from './components/CameraView';
import ReactionPicker from './components/ReactionPicker';

const TRANSLATIONS = {
  en: {
    title: "Sight Link",
    tagline: "Anonymous Human Exchange.",
    capture_prompt: "Share your moment to connect",
    loading_desc: "Verifying your live capture...",
    swipe_tip: "Swipe left to explore",
    no_moments: "Waiting for world explorers...",
    come_back: "Exchange Again",
    summary_title: "Global Pulse",
    connection_msg: (n: number) => `Synced with ${n} real human visions.`,
    syncing: "Synchronizing..."
  },
  zh: {
    title: "視界交換",
    tagline: "與陌生人交換真實視界",
    capture_prompt: "捕捉瞬間以建立連結",
    loading_desc: "正在驗證您的即時拍攝...",
    swipe_tip: "向左滑動以探索世界",
    no_moments: "正在等待全球探索者...",
    come_back: "再次交換視界",
    summary_title: "視界總結",
    connection_msg: (n: number) => `已與全球 ${n} 位真實旅者同步視界。`,
    syncing: "正在同步..."
  }
};

interface FlyingEmoji {
  id: number;
  emoji: string;
  left: number;
}

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh');
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [moments, setMoments] = useState<WorldMoment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  // Interaction State
  const [dragX, setDragX] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const touchStartX = useRef<number | null>(null);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const info = await getLocationName(pos.coords.latitude, pos.coords.longitude);
        setUserLoc({ ...info, lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {
        setUserLoc({ city: "Earth", country: "Global", city_zh: "地球", country_zh: "全球", lat: 0, lng: 0 });
      });
    }
  }, []);

  const handleCapture = async (imageData: string) => {
    setUserPhoto(imageData);
    setState(AppState.UPLOADING);
    
    try {
      setLoadingMsg(t.loading_desc);
      const authResult = await verifyAuthenticity(imageData);
      
      const { moments: pool, selfId } = await momentStore.syncWithGlobal(
        imageData, 
        userLoc || { city: "Earth", country: "Global", city_zh: "地球", country_zh: "全球", lat: 0, lng: 0 },
        (msg) => setLoadingMsg(msg)
      );
      
      // 僅獲取真實用戶，排除自己，最多10張
      const others = pool.filter(m => m.id !== selfId).slice(0, 10);
      setMoments(others);
      
      if (others.length === 0) {
        setLoadingMsg(t.no_moments);
        setTimeout(() => setState(AppState.LANDING), 3000);
      } else {
        setState(AppState.SWIPING);
      }
    } catch (err: any) {
      setLoadingMsg(`⚠️ 同步失敗: ${err.message}`);
      setTimeout(() => setState(AppState.LANDING), 3000);
    }
  };

  const nextMoment = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      setDragX(0);
      setIsExiting(false);
      if (currentIndex < moments.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setState(AppState.SUMMARY);
      }
    }, 400);
  }, [currentIndex, moments.length, isExiting]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isExiting) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isExiting || touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    if (diff < 0) setDragX(diff); // 僅允許向左滑
    else setDragX(diff * 0.1); // 向右滑提供一點阻力反饋
  };

  const handleTouchEnd = () => {
    if (isExiting) return;
    if (dragX < -100) nextMoment();
    else setDragX(0); // 回彈
    touchStartX.current = null;
  };

  const handleReaction = (emoji: string) => {
    const newEmoji: FlyingEmoji = { id: Date.now(), emoji, left: 30 + Math.random() * 40 };
    setFlyingEmojis(prev => [...prev, newEmoji]);
    setTimeout(() => setFlyingEmojis(prev => prev.filter(e => e.id !== newEmoji.id)), 1000);
  };

  const renderContent = () => {
    switch (state) {
      case AppState.LANDING:
        return (
          <div className="flex flex-col items-center justify-center h-[100vh] p-8 text-center space-y-12 bg-black overflow-hidden">
            <div className="space-y-4 animate-text-reveal">
              <h1 className="text-7xl font-black tracking-tighter bg-gradient-to-b from-white to-zinc-800 bg-clip-text text-transparent">
                {t.title}
              </h1>
              <p className="text-zinc-500 text-lg font-medium tracking-wide uppercase opacity-80">
                {t.tagline}
              </p>
            </div>
            
            <button 
              onClick={() => setState(AppState.CAPTURING)} 
              className="w-full aspect-square max-w-[320px] relative rounded-[3.5rem] overflow-hidden glass group transition-all active:scale-95 duration-500 shadow-[0_40px_100px_rgba(255,255,255,0.03)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 to-black group-hover:scale-110 transition-transform duration-1000" />
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                <div className="w-20 h-20 rounded-full border border-white/5 flex items-center justify-center bg-white/5 backdrop-blur-3xl shadow-2xl">
                  <span className="text-4xl">📸</span>
                </div>
                <p className="font-black text-white text-[10px] tracking-[0.5em] uppercase opacity-70">
                  {t.capture_prompt}
                </p>
              </div>
            </button>
          </div>
        );

      case AppState.CAPTURING: 
        return <CameraView onCapture={handleCapture} onCancel={() => setState(AppState.LANDING)} />;

      case AppState.UPLOADING: 
        return (
          <div className="flex flex-col items-center justify-center h-[100vh] p-8 text-center space-y-10 animate-card-enter">
            <div className="relative w-56 h-56 flex items-center justify-center">
              <div className="absolute inset-0 border border-white/10 rounded-full animate-[ping_3s_linear_infinite]" />
              <div className="w-48 h-48 rounded-full overflow-hidden border border-white/20 shadow-2xl">
                {userPhoto && <img src={userPhoto} className="w-full h-full object-cover grayscale opacity-50" alt="Capture" />}
              </div>
            </div>
            <div className="space-y-4 animate-text-reveal">
              <p className="text-2xl font-black text-white">{loadingMsg}</p>
              <p className="text-zinc-600 text-[9px] font-black tracking-[0.3em] uppercase">{t.loading_desc}</p>
            </div>
          </div>
        );

      case AppState.SWIPING:
        const current = moments[currentIndex];
        if (!current) return null;
        return (
          <div className="h-[100vh] p-4 flex flex-col max-w-md mx-auto relative overflow-hidden select-none animate-card-enter">
            {flyingEmojis.map(fe => <div key={fe.id} className="absolute z-[100] text-5xl pointer-events-none animate-fly-up" style={{ left: `${fe.left}%`, bottom: '150px' }}>{fe.emoji}</div>)}
            
            <div className="flex justify-between items-end mb-6 pt-10 px-4 animate-text-reveal">
              <div className="space-y-1">
                <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">
                  {lang === 'zh' ? current.location.city_zh : current.location.city}
                </h2>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  {lang === 'zh' ? current.location.country_zh : current.location.country} • {currentIndex + 1}/{moments.length}
                </p>
              </div>
              <div className="glass px-3 py-1.5 rounded-full">
                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">LIVE VISION</p>
              </div>
            </div>

            <div 
              className={`relative flex-grow rounded-[3.5rem] overflow-hidden shadow-[0_50px_120px_rgba(0,0,0,0.9)] border border-white/10 bg-zinc-900 transition-all duration-150 ease-out ${isExiting ? 'animate-card-exit' : ''}`}
              style={{ 
                transform: isExiting ? undefined : `translateX(${dragX}px) rotate(${dragX * 0.02}deg)`,
                opacity: isExiting ? 0 : 1 
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img src={current.imageUrl} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="Vision" />
              <div className="absolute top-8 right-8 flex flex-col items-end gap-3">
                <div className="glass px-4 py-2 rounded-full text-[10px] font-black tracking-widest shadow-2xl backdrop-blur-3xl">
                  {lang === 'zh' ? current.location.city_zh : current.location.city}
                </div>
              </div>
            </div>

            <div className="mt-8 mb-8 flex items-center justify-between gap-4 px-2 animate-text-reveal">
              <div className="flex-grow"><ReactionPicker onReact={handleReaction} /></div>
              <button 
                onClick={nextMoment} 
                disabled={isExiting}
                className="w-[72px] h-[72px] bg-white text-black rounded-full active:scale-90 transition-all flex items-center justify-center shadow-2xl disabled:opacity-50"
              >
                {currentIndex === moments.length - 1 ? <span className="text-2xl">🏁</span> : <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
              </button>
            </div>
            <p className="pb-8 text-center text-[9px] text-zinc-700 font-black tracking-[0.4em] uppercase">{t.swipe_tip}</p>
          </div>
        );

      case AppState.SUMMARY:
        return (
          <div className="h-[100vh] p-8 flex flex-col justify-center items-center space-y-12 text-center bg-black">
            <div className="space-y-3 animate-text-reveal">
              <h1 className="text-5xl font-black tracking-tighter uppercase">{t.summary_title}</h1>
              <p className="text-zinc-500 font-bold text-sm tracking-widest">{t.connection_msg(moments.length)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 w-full max-w-sm animate-card-enter">
              <div className="space-y-4">
                <p className="text-[9px] font-black text-zinc-600 tracking-widest uppercase text-left pl-2">YOU</p>
                <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                  {userPhoto && <img src={userPhoto} className="w-full h-full object-cover" alt="Me" />}
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[9px] font-black text-zinc-600 tracking-widest uppercase text-left pl-2">WORLD</p>
                <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                  {moments[0] && <img src={moments[0].imageUrl} className="w-full h-full object-cover" alt="World" />}
                </div>
              </div>
            </div>

            <button 
              onClick={() => { setState(AppState.LANDING); setCurrentIndex(0); }} 
              className="w-full max-w-xs py-6 bg-white text-black font-black rounded-[2rem] active:scale-95 transition-all tracking-[0.3em] uppercase text-xs shadow-3xl"
            >
              {t.come_back}
            </button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-inter selection:bg-white selection:text-black">
      <button 
        onClick={() => setLang(prev => prev === 'en' ? 'zh' : 'en')} 
        className="fixed top-8 right-8 z-[100] glass px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest hover:bg-white/10 transition-colors uppercase"
      >
        {lang === 'en' ? 'ZH' : 'EN'}
      </button>
      <div className="fixed top-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-500/5 blur-[200px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-20%] w-[70%] h-[70%] bg-rose-500/5 blur-[200px] rounded-full pointer-events-none" />
      <main className="h-full w-full">{renderContent()}</main>
    </div>
  );
};

export default App;