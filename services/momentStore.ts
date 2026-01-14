
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
    
    // 邏輯：保留最新的 15 張，移除任何保留舊照片的規則
    let updatedPool = [newMoment, ...pool];
    
    // 如果超過 15 張，裁切掉最舊的
    if (updatedPool.length > 15) {
      updatedPool = updatedPool.slice(0, 15);
    }

    localStorage.setItem(STORE_KEY, JSON.stringify(updatedPool));
    return newMoment;
  },

  getExchangeMoments: (currentId: string): WorldMoment[] => {
    const pool = momentStore.getMoments();
    // 過濾掉當前剛上傳的，返回池中剩餘的所有照片（最多 14 張）
    return pool.filter(m => m.id !== currentId);
  }
};
