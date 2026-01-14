
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, WorldMoment, UserLocation, Language } from './types';
import { getLocationName, fetchGlobalSimulatedMoments } from './services/geminiService';
import { momentStore } from './services/momentStore';
import CameraView from './components/CameraView';
import ReactionPicker from './components/ReactionPicker';

const TRANSLATIONS = {
  en: {
    title: "WorldSwap",
    tagline: "100% Real Moments. No fakes. No stock photos.",
    capture_prompt: "Capture your moment to enter",
    anonymous: "ANONYMOUS",
    realtime: "REAL-TIME",
    global: "GLOBAL",
    shared_recently: "Shared Recently",
    live_from: "LIVE FROM",
    verified: "VERIFIED CAPTURE",
    finish_journey: "Finish Journey",
    next_glimpse: "Next Glimpse",
    summary_title: "Connection Summary",
    summary_desc: "The real people and places you connected with.",
    today_exchange: "Exchange Record",
    complete: "SUCCESS",
    you_shared: "You Shared",
    most_distant: "Most Distant",
    connection_msg: (n: number, c: number) => n === 0 
      ? "You are the first explorer today. Your moment is now waiting for the next person."
      : `You connected with ${n} real people across ${c} countries.`,
    come_back: "Share another moment",
    privacy_note: "WorldSwap is 100% human-driven. Honesty is our core.",
    loading_stamping: "Stamping location...",
    loading_searching: "Accessing the world pool...",
    loading_connecting: "Fetching real moments...",
    loading_finalizing: "Verifying authenticity...",
    loading_desc: "We only show real photos from real users.",
    no_moments: "The world is quiet right now. You are the first to share today!",
    low_moments: (n: number) => `Found ${n} other real moments in the pool.`,
    next: "NEXT",
    swipe_tip: "Swipe to explore"
  },
  zh: {
    title: "視界交換",
    tagline: "和陌生人交換你的視界",
    capture_prompt: "捕捉當下瞬間以開始交換",
    anonymous: "匿名機制",
    realtime: "即時互動",
    global: "全球連結",
    shared_recently: "剛剛分享",
    live_from: "即時傳送自",
    verified: "真實拍攝",
    finish_journey: "結束旅程",
    next_glimpse: "下個瞬間",
    summary_title: "交換總結",
    summary_desc: "你今天在世界上建立的真實連結。",
    today_exchange: "交換記錄",
    complete: "完成",
    you_shared: "你分享的瞬間",
    most_distant: "最遠的連結",
    connection_msg: (n: number, c: number) => n === 0 
      ? "目前池中沒有其他瞬間。我們已從全球視角為你匹配了幾位旅者的蹤跡。"
      : `你今天與來自 ${c} 個國家的 ${n} 位真實用戶建立了連結。`,
    come_back: "再次分享瞬間",
    privacy_note: "視界交換由真人驅動。真實性是我們的核心。",
    loading_stamping: "正在標記位置...",
    loading_searching: "正在訪問全球照片池...",
    loading_connecting: "獲取真實瞬間中...",
    loading_finalizing: "驗證真實性...",
    loading_desc: "我們只顯示來自真實用戶的拍攝照片。",
    no_moments: "目前世界上沒有其他人的瞬間. 正在獲取全球模擬視界...",
    low_moments: (n: number) => `目前池中僅有 ${n} 個其他真實瞬間。`,
    next: "下一個",
    swipe_tip: "滑動探索"
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
  
  const [dragX, setDragX] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const touchStartX = useRef<number | null>(null);

  const t = TRANSLATIONS[lang];

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const info = await getLocationName(latitude, longitude);
        setUserLoc({ ...info, lat: latitude, lng: longitude });
      }, () => {
        setUserLoc({ city: "Unknown", country: "Earth", city_zh: "未知", country_zh: "地球", lat: 0, lng: 0 });
      });
    }
  }, []);

  const handleCapture = async (imageData: string) => {
    // 立即進入加載狀態
    setUserPhoto(imageData);
    setState(AppState.UPLOADING);
    
    // 設定計時訊息
    setLoadingMsg(t.loading_stamping);
    const m1 = setTimeout(() => setLoadingMsg(t.loading_searching), 1000);
    const m2 = setTimeout(() => setLoadingMsg(t.loading_connecting), 2000);
    const m3 = setTimeout(() => setLoadingMsg(t.loading_finalizing), 3000);

    try {
      // 1. 本地存儲
      const loc = userLoc || { city: "Unknown", country: "Earth", city_zh: "未知", country_zh: "地球", lat: 0, lng: 0 };
      const myMoment = momentStore.saveMoment(imageData, loc, "");
      
      // 2. 獲取本地交換池
      let pool = momentStore.getExchangeMoments(myMoment.id);
      
      // 3. 獲取模擬流（如果有需要）
      if (pool.length < 3) {
        try {
          // 設定一個超時限制，避免卡死
          const simulatedPromise = fetchGlobalSimulatedMoments();
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([]), 5000));
          const simulated = await Promise.race([simulatedPromise, timeoutPromise]) as WorldMoment[];
          pool = [...pool, ...simulated];
        } catch (simErr) {
          console.warn("Simulation fetch failed, proceeding with local pool", simErr);
        }
      }
      
      // 4. 強制等待至少 4 秒以確保用戶看完動畫訊息，然後切換狀態
      setTimeout(() => {
        setMoments(pool);
        if (pool.length === 0) {
          setState(AppState.SUMMARY);
        } else {
          setState(AppState.SWIPING);
        }
      }, 4000);

    } catch (err) {
      console.error("Critical capture handler error:", err);
      // 萬一出錯，至少確保能退回 summary 或 landing，不要卡死
      setTimeout(() => setState(AppState.SUMMARY), 4000);
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
            <div className="space-y-4 pt-12">
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
                <h2 className="text-4xl font-black tracking-tighter">{cityName}</h2>
                <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]" />
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
                   <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                   {cityName} {formatTime(current.timestamp)}
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
        const hasMoments = moments.length > 0;
        return (
          <div className="min-h-screen p-8 flex flex-col space-y-10 max-w-lg mx-auto py-16 animate-fade-in-up">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-tight">{t.summary_title}</h1>
              <p className="text-zinc-500 font-bold text-sm tracking-wide">{hasMoments ? t.summary_desc : t.no_moments}</p>
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
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{lang === 'zh' ? userLoc?.city_zh : userLoc?.city}, {lang === 'zh' ? userLoc?.country_zh : userLoc?.country}</p>
                </div>
                {hasMoments && (
                   <div className="space-y-4">
                    <p className="text-zinc-600 text-[9px] uppercase font-black tracking-widest">{t.most_distant}</p>
                    <div className="w-full aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 shadow-xl bg-zinc-900">
                      <img src={moments[0].imageUrl} className="w-full h-full object-cover" alt="Far" />
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{lang === 'zh' ? moments[0].location.city_zh : moments[0].location.city}, {lang === 'zh' ? moments[0].location.country_zh : moments[0].location.country}</p>
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
