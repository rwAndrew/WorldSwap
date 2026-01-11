
import { WorldMoment, UserLocation } from '../types';

const STORE_KEY = 'worldswap_moment_pool';

export const momentStore = {
  getMoments: (): WorldMoment[] => {
    const data = localStorage.getItem(STORE_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveMoment: (photo: string, location: UserLocation, caption: string): WorldMoment => {
    const pool = momentStore.getMoments();
    const newMoment: WorldMoment = {
      id: Math.random().toString(36).substring(7),
      imageUrl: photo,
      location,
      timestamp: new Date().toISOString(),
      caption: caption || "Captured a moment.",
      reactions: {}
    };
    
    // Add to pool and keep only latest 50 to simulate a fresh rolling database
    const updatedPool = [newMoment, ...pool].slice(0, 50);
    localStorage.setItem(STORE_KEY, JSON.stringify(updatedPool));
    return newMoment;
  },

  getExchangeMoments: (currentId: string): WorldMoment[] => {
    const pool = momentStore.getMoments();
    // Filter out the current user's just-uploaded photo and return up to 10 others
    return pool.filter(m => m.id !== currentId).slice(0, 10);
  }
};
