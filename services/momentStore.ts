
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
      caption: caption || "",
      reactions: {}
    };
    
    // 邏輯：保留最新的 10 張，並預留最早的 5 張
    let updatedPool = [newMoment, ...pool];
    
    if (updatedPool.length > 15) {
      const latest10 = updatedPool.slice(0, 10);
      const oldest5 = updatedPool.slice(-5);
      updatedPool = [...latest10, ...oldest5];
    }

    localStorage.setItem(STORE_KEY, JSON.stringify(updatedPool));
    return newMoment;
  },

  getExchangeMoments: (currentId: string): WorldMoment[] => {
    const pool = momentStore.getMoments();
    // 過濾掉當前剛上傳的，並返回最多 10 張供交換
    return pool.filter(m => m.id !== currentId).slice(0, 10);
  }
};
