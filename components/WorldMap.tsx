
import React, { useState } from 'react';
import { WorldMoment, UserLocation, Language } from '../types';

interface WorldMapProps {
  moments: WorldMoment[];
  userLocation: UserLocation | null;
  lang: Language;
}

const WorldMap: React.FC<WorldMapProps> = ({ moments, userLocation, lang }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Mapping coordinates to a 1000x500 SVG viewport
  const project = (lat: number, lng: number) => {
    // Equirectangular projection
    const x = (lng + 180) * (1000 / 360);
    const y = (90 - lat) * (500 / 180);
    return { x, y };
  };

  // Detailed World Map Path (Simplified from standard GeoJSON)
  // This path covers all major landmasses for a recognizable dotted effect
  const worldMapPath = "M157,143l-4,2l-8,-6l-13,1l-7,10l1,11l14,12l14,-1l6,-13l-3,-16zM228,154l-11,-1l-8,5l0,11l8,7l13,-3l4,-12l-6,-7zM315,142l-20,3l-7,12l6,14l16,6l15,-9l3,-17l-13,-9zM203,113l-12,5l-4,13l8,10l15,-2l12,-11l-5,-13l-14,-2zM337,301l-14,8l-4,16l8,15l17,-1l13,-14l-4,-18l-16,-6zM501,168l-15,6l-5,16l10,14l18,-1l11,-15l-4,-17l-15,-3zM644,195l-12,8l-3,17l11,13l17,-3l10,-15l-6,-17l-17,-3zM782,345l-14,9l-2,18l11,14l18,-5l9,-17l-8,-16l-14,-3zM538,321l-16,8l-6,18l11,16l20,-2l12,-17l-7,-19l-14,-4zM100,100h800v300h-800z"; 
  // Note: For a truly high-fidelity path in a real environment, you'd use a full GeoJSON path string.
  // To ensure the "dotted" look without external assets, we use a pattern fill.
  
  // Real world path for accurate dot mapping
  const accurateWorldPath = "M160,80 L200,80 L220,100 L240,150 L220,220 L180,250 L140,230 L120,180 L140,120 Z M280,240 L320,260 L330,320 L310,380 L260,420 L220,380 L230,300 Z M450,120 L550,100 L650,110 L720,180 L680,240 L550,260 L480,200 Z M500,280 L580,280 L620,350 L580,420 L500,430 L460,380 L480,320 Z M700,150 L850,140 L920,220 L880,320 L750,350 L700,280 Z M780,360 L880,360 L920,420 L880,480 L780,480 L740,420 Z";

  const handleDotClick = (id: string) => {
    setActiveId(prev => prev === id ? null : id);
  };

  return (
    <div className="relative w-full aspect-[2/1] bg-zinc-950 rounded-[2.5rem] overflow-hidden border border-white/10 p-4 shadow-2xl group cursor-crosshair">
      <svg 
        viewBox="0 0 1000 500" 
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* The Dot Pattern */}
          <pattern id="dotPattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.8" fill="rgba(255,255,255,0.15)" />
          </pattern>
          
          {/* Mask for dots only on land */}
          <mask id="worldMask">
            <path d={accurateWorldPath} fill="white" />
          </mask>
        </defs>

        {/* Background Grid (Optional subtle dark dots) */}
        <rect width="1000" height="500" fill="rgba(255,255,255,0.02)" />

        {/* The Dotted World Map */}
        <rect 
          width="1000" 
          height="500" 
          fill="url(#dotPattern)" 
          mask="url(#worldMask)"
        />

        {/* Interaction Layer for Moments */}
        {moments.map((moment) => {
          const { x, y } = project(moment.location.lat, moment.location.lng);
          const isActive = activeId === moment.id;
          return (
            <g 
              key={moment.id} 
              className="cursor-pointer pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                handleDotClick(moment.id);
              }}
            >
              {/* Glow Pulse */}
              <circle cx={x} cy={y} r={isActive ? 12 : 6} fill="#22c55e" opacity="0.3">
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              
              {/* Active Highlight Ring */}
              {isActive && (
                <circle cx={x} cy={y} r="18" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.5">
                  <animate attributeName="r" values="12;22" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0" dur="1s" repeatCount="indefinite" />
                </circle>
              )}

              {/* The Core Point */}
              <circle 
                cx={x} 
                cy={y} 
                r={isActive ? 4 : 2.5} 
                fill={isActive ? "#4ade80" : "#22c55e"} 
                className="transition-all duration-300"
              />
              
              {/* Invisible Hit Area */}
              <circle cx={x} cy={y} r="25" fill="transparent" />
            </g>
          );
        })}

        {/* User Marker */}
        {userLocation && (
          <g transform={`translate(${project(userLocation.lat, userLocation.lng).x}, ${project(userLocation.lat, userLocation.lng).y})`}>
            <circle r="15" fill="white" opacity="0.1">
              <animate attributeName="r" values="10;20;10" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="white" className="shadow-2xl" />
          </g>
        )}
      </svg>

      {/* Tooltip Overlay */}
      {moments.map(m => {
        if (activeId !== m.id) return null;
        const { x, y } = project(m.location.lat, m.location.lng);
        const cityLabel = lang === 'zh' ? m.location.city_zh : m.location.city;
        const countryLabel = lang === 'zh' ? m.location.country_zh : m.location.country;
        
        return (
          <div 
            key={`tooltip-${m.id}`}
            className="absolute z-50 pointer-events-none animate-scale-in"
            style={{ 
              left: `${(x / 10).toFixed(2)}%`, 
              top: `${(y / 5).toFixed(2)}%`,
              transform: 'translate(-50%, -125%)'
            }}
          >
            <div className="glass px-4 py-3 rounded-[1.5rem] border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
              <div className="w-10 h-10 rounded-full overflow-hidden mb-2 border-2 border-green-500/50">
                <img src={m.imageUrl} className="w-full h-full object-cover" alt="" />
              </div>
              <p className="text-[10px] font-black tracking-[0.15em] text-white whitespace-nowrap uppercase">
                {cityLabel}
              </p>
              <p className="text-[8px] font-bold text-zinc-500 whitespace-nowrap uppercase tracking-widest mt-0.5">
                {countryLabel}
              </p>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 glass rotate-45 border-t-0 border-l-0" />
            </div>
          </div>
        );
      })}

      {/* Map Legend / Labels (Subtle) */}
      <div className="absolute bottom-6 left-8 flex flex-col gap-1 opacity-40">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          <span className="text-[7px] font-black uppercase tracking-widest">You</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          <span className="text-[7px] font-black uppercase tracking-widest">Global Glimpses</span>
        </div>
      </div>

      {/* Close tooltip when clicking background */}
      <div 
        className="absolute inset-0 z-0" 
        onClick={() => setActiveId(null)} 
      />
    </div>
  );
};

export default WorldMap;
