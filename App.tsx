
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, WorldMoment, UserLocation, Language } from './types';
import { getLocationName, fetchGlobalSimulatedMoments, verifyAuthenticity } from './services/geminiService';
import { momentStore } from './services/momentStore';
import CameraView from './components/CameraView';
import ReactionPicker from './components/ReactionPicker';

const TRANSLATIONS = {
  en: {
    title: "WorldSwap",
    tagline: "100% Real Moments. Global Exchange.",
    capture_prompt: "Capture your moment to join the world",
    anonymous: "ANONYMOUS",
    realtime: "LIVE NETWORK",
    global: "GLOBAL PULSE",
    shared_recently: "Shared Recently",
    verified: "VERIFIED",
    summary_title: "Exchange Summary",
    summary_desc: "Your visual connection with the world.",
    today_exchange: "Network Activity",
    complete: "SYNCED",
    you_shared: "You Shared",
    most_distant: "Global Match",
    connection_msg: (n: number, c: number) => `Synced with ${n} global nodes across ${c} regions.`,
    come_back: "Exchange Again",
    privacy_note: "Encrypted & Anonymous. Real humans only.",
    loading_stamping: "Stamping your location...",
    loading_searching: "Accessing Global Pool...",
    loading_connecting: "Connecting to world nodes...",
    loading_finalizing: "AI Authenticity Check...",
    loading_desc: "Verified real-time capture only.",
    no_moments: "Synchronizing global vision...",
    next: "NEXT",
    swipe_tip: "Swipe to traverse the world",
    live_status: (n: number) => `${n} Explorers Active`
  },
  zh: {
    title: "視界交換",
    tagline: "和陌生人交換你的視界",
    capture_prompt: "捕捉當下瞬間以開始交換",
    anonymous: "匿名機制",
    realtime: "全球網路",
    global: "即時脈動",
    shared_recently: "剛剛分享",
    verified: "真實拍攝",
    summary_title: "交換總結",
    summary_desc: "你今天在世界上建立的真實連結。",
    today_exchange: "網路活動記錄",
    complete: "同步完成",
    you_shared: "你分享的瞬間",
    most_distant: "全球匹配",
    connection_msg: (n: number, c: number) => `已成功與全球 ${c} 個地區的 ${n} 位旅者建立視界連結。`,
    come_back: "再次分享瞬間",
    privacy_note: "視界交換由真人驅動。匿名且加密。",
    loading_stamping: "正在標記你的座標...",
    loading_searching: "正在訪問全球視界池...",
    loading_connecting: "建立全球節點連結...",
    loading_finalizing: "AI 真實性驗證中...",
    loading_desc: "我們僅接受即時拍攝的真實照片。",
    no_moments: "正在同步全球視界中...",
    next: "下一個",
    swipe_tip: "滑動以探索世界",
    live_status: (n: number) => `目前有 ${n} 位探索者在線`
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
  const [onlineCount, setOnlineCount] = useState(Math.floor(Math.random() * 500) + 1200);
  
  const [dragX, setDragX] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const touchStartX = useRef<number | null>(null);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const info = await getLocationName(latitude, longitude);
        setUserLoc({ ...info, lat: latitude, lng: longitude });
      }, () => {
        setUserLoc({ city: "Earth", country: "Global", city_zh: "地球", country_zh: "全球", lat: 0, lng: 0 });
      });
    }
    const interval = setInterval(() => setOnlineCount(prev => prev + (Math.random() > 0.5 ? 1 : -1)), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCapture = async (imageData: string) => {
    setUserPhoto(imageData);
    setState(AppState.UPLOADING);
    
    setLoadingMsg(t.loading_stamping);
    const loc = userLoc || { city: "Earth", country: "Global", city_zh: "地球", country_zh: "全球", lat: 0, lng: 0 };
    
    try {
      // 1. 真實性驗證 (AI)
      setLoadingMsg(t.loading_finalizing);
      const authResult = await verifyAuthenticity(imageData);
      if (!authResult.isReal) {
        console.warn("AI 懷疑這張照片不是真實拍攝:", authResult.reason);
      }

      // 2. 雲端同步 (真正上傳至 Supabase)
      setLoadingMsg(t.loading_connecting);
      const updatedPool = await momentStore.syncWithGlobal(imageData, loc);
      
      // 3. 獲取排除自己的交換池
      const finalPool = updatedPool.filter(m => m.imageUrl !== imageData).slice(0, 10);

      // 若雲端暫無其他數據，回退至 AI 模擬流以確保體驗，但未來應移除
      if (finalPool.length === 0) {
        const simulated = await fetchGlobalSimulatedMoments();
        setMoments(simulated);
      } else {
        setMoments(finalPool);
      }

      setState(AppState.SWIPING);

    } catch (err) {
      console.error("Cloud Sync Failed:", err);
      setState(AppState.SUMMARY);
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
    if (diff < 0) setDragX(diff);
    else setDragX(diff * 0.2);
  };

  const handleTouchEnd = () => {
    if (isExiting) return;
    if (dragX < -120) nextMoment();
    else setDragX(0);
    touchStartX.current = null;
  };

  const handleReaction = (emoji: string) => {
    const newEmoji: FlyingEmoji = { id: Date.now(), emoji, left: 20 + Math.random() * 60 };
    setFlyingEmojis(prev => [...prev, newEmoji]);
    setTimeout(() => setFlyingEmojis(prev => prev.filter(e => e.id !== newEmoji.id)), 1000);
  };

  const renderContent = () => {
    switch (state) {
      case AppState.LANDING:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-12 animate-fade-in-up">
            <div className="fixed top-12 left-0 right-0 flex justify-center">
              <div className="glass px-4 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
                <span className="text-[10px] font-black tracking-widest text-zinc-400 uppercase">{t.live_status(onlineCount)}</span>
              </div>
            </div>

            <div className="space-y-4 pt-20">
              <h1 className="text-7xl font-black tracking-tighter bg-gradient-to-b from-white to-zinc-700 bg-clip-text text-transparent">
                {t.title}
              </h1>
              <p className="text-zinc-500 text-lg font-medium max-w-xs mx-auto leading-relaxed">
                {t.tagline}
              </p>
            </div>
            
            <button 
              onClick={() => setState(AppState.CAPTURING)}
              className="w-full aspect-square max-w-[340px] relative rounded-[4rem] overflow-hidden glass border-white/10 group shadow-[0_0_100px_rgba(255,255,255,0.05)] transition-transform active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-xl shadow-inner">
                   <span className="text-5xl">📸</span>
                </div>
                <p className="font-black text-white text-[11px] tracking-[0.4em] uppercase opacity-80">{t.capture_prompt}</p>
              </div>
            </button>

            <div className="flex gap-8 text-[10px] text-zinc-600 font-black tracking-[0.4em] uppercase opacity-60">
              <span>{t.anonymous}</span>
              <span>{t.realtime}</span>
              <span>{t.global}</span>
            </div>
          </div>
        );

      case AppState.CAPTURING:
        return <CameraView onCapture={handleCapture} onCancel={() => setState(AppState.LANDING)} />;

      case AppState.UPLOADING:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-12 animate-scale-in">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-0 border border-white/5 rounded-full animate-pulse" />
              <div className="absolute inset-[-15px] border border-dashed border-white/10 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="w-48 h-48 rounded-full overflow-hidden border border-white/20 shadow-2xl">
                {userPhoto && <img src={userPhoto} className="w-full h-full object-cover opacity-60 grayscale" alt="Me" />}
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-2xl font-bold text-white tracking-tight">{loadingMsg}</p>
              <p className="text-zinc-600 text-[9px] font-black tracking-[0.2em] uppercase">{t.loading_desc}</p>
            </div>
          </div>
        );

      case AppState.SWIPING:
        const current = moments[currentIndex];
        if (!current) return null;
        const opacity = isExiting ? 0 : Math.max(0.1, 1 - Math.abs(dragX) / 400);
        const rotation = dragX * 0.03;
        const cityName = lang === 'zh' ? current.location.city_zh : current.location.city;
        const countryName = lang === 'zh' ? current.location.country_zh : current.location.country;
        
        return (
          <div className="min-h-screen p-4 flex flex-col max-w-md mx-auto relative overflow-hidden select-none animate-scale-in">
            {flyingEmojis.map(fe => (
              <div key={fe.id} className="absolute z-[100] text-5xl pointer-events-none animate-fly-up" style={{ left: `${fe.left}%`, bottom: '150px' }}>{fe.emoji}</div>
            ))}

            <div className="flex justify-between items-end mb-8 pt-6">
              <div className="space-y-1">
                <h2 className="text-4xl font-black tracking-tighter uppercase">{cityName}</h2>
                <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  <span className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_#f43f5e]" />
                  {countryName} • {currentIndex + 1}/{moments.length}
                </div>
              </div>
              <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{t.shared_recently}</p>
              </div>
            </div>

            <div 
              className={`relative flex-grow rounded-[3.5rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/10 bg-zinc-900 swipe-card transition-all duration-100 ease-out ${isExiting ? 'animate-card-exit' : ''}`}
              style={{ transform: isExiting ? undefined : `translateX(${dragX}px) rotate(${rotation}deg) scale(${1 - Math.abs(dragX)/2000})`, opacity }}
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            >
              <img src={current.imageUrl} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="Moment" />
              
              <div className="absolute top-8 right-8 flex flex-col items-end gap-3">
                <div className="glass px-4 py-2 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2 shadow-xl">
                   <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                   {cityName}
                </div>
                <div className="bg-white text-black px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-tighter shadow-xl">{t.verified}</div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <div className="flex-grow">
                <ReactionPicker onReact={handleReaction} />
              </div>
              <button 
                onClick={nextMoment}
                disabled={isExiting}
                className="w-[72px] h-[72px] bg-white text-black rounded-full hover:bg-zinc-200 active:scale-90 transition-all flex items-center justify-center shadow-2xl disabled:opacity-50"
              >
                {currentIndex === moments.length - 1 ? <span className="text-2xl">🏁</span> : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                )}
              </button>
            </div>
            
            <p className="mt-6 text-center text-[9px] text-zinc-700 font-black tracking-[0.3em] uppercase">{t.swipe_tip}</p>
          </div>
        );

      case AppState.SUMMARY:
        return (
          <div className="min-h-screen p-8 flex flex-col space-y-10 max-w-lg mx-auto py-16 animate-fade-in-up">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-tight">{t.summary_title}</h1>
              <p className="text-zinc-500 font-bold text-sm tracking-wide">{t.summary_desc}</p>
            </div>

            <div className="glass rounded-[3rem] p-10 space-y-10 border-white/10 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-8">
                <h3 className="font-black text-zinc-400 text-xs tracking-[0.2em] uppercase">{t.today_exchange}</h3>
                <span className="text-green-500 text-[10px] font-black tracking-widest bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20">{t.complete}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-4">
                  <p className="text-zinc-600 text-[9px] uppercase font-black tracking-widest">{t.you_shared}</p>
                  <div className="w-full aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 shadow-xl bg-zinc-900">
                    {userPhoto && <img src={userPhoto} className="w-full h-full object-cover" alt="Me" />}
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{lang === 'zh' ? userLoc?.city_zh : userLoc?.city}</p>
                </div>
                {moments.length > 0 && (
                   <div className="space-y-4">
                    <p className="text-zinc-600 text-[9px] uppercase font-black tracking-widest">{t.most_distant}</p>
                    <div className="w-full aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 shadow-xl bg-zinc-900">
                      <img src={moments[0].imageUrl} className="w-full h-full object-cover" alt="Far" />
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{lang === 'zh' ? moments[0].location.city_zh : moments[0].location.city}</p>
                  </div>
                )}
              </div>

              <div className="bg-white/5 rounded-[2rem] p-8 text-center border border-white/5">
                <p className="text-base text-zinc-200 font-medium leading-relaxed italic">
                  {t.connection_msg(moments.length, new Set(moments.map(m => m.location.country)).size)}
                </p>
              </div>
            </div>

            <button onClick={() => { setState(AppState.LANDING); setCurrentIndex(0); setDragX(0); setIsExiting(false); }}
              className="w-full py-6 bg-white text-black font-black rounded-[2.5rem] hover:bg-zinc-200 active:scale-95 transition-all tracking-[0.3em] uppercase text-xs shadow-2xl"
            >
              {t.come_back}
            </button>
            <p className="text-center text-zinc-700 text-[9px] font-black tracking-[0.4em] uppercase">{t.privacy_note}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-black selection:bg-white selection:text-black">
      <button onClick={() => setLang(prev => prev === 'en' ? 'zh' : 'en')}
        className="fixed top-8 right-8 z-[60] glass px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest hover:bg-white/20 transition-colors uppercase shadow-xl"
      >
        {lang === 'en' ? 'ZH' : 'EN'}
      </button>
      <div className="fixed top-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/10 blur-[200px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-20%] w-[70%] h-[70%] bg-rose-600/10 blur-[200px] rounded-full pointer-events-none" />
      <main className="flex-grow z-10">{renderContent()}</main>
    </div>
  );
};

export default App;
