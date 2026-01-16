
import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

// 從環境變數獲取配置
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// 只有在配置存在時才初始化，否則輸出錯誤提示
// 這能防止應用程序在初次載入時因為缺少 URL 而直接崩潰
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const BUCKET_NAME = 'moment-photos';

/**
 * 將 Base64 轉換為 Blob 供 Supabase Storage 上傳
 */
function base64ToBlob(base64: string, contentType: string = 'image/jpeg') {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
}

export const momentStore = {
  /**
   * 獲取全球最新的 15 張照片
   */
  getMoments: async (): Promise<WorldMoment[]> => {
    if (!supabase) {
      console.error("Supabase client not initialized. Check your environment variables.");
      return [];
    }

    const { data, error } = await supabase
      .from('moments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error("Supabase Select Error:", error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      imageUrl: item.image_url,
      location: item.location,
      timestamp: item.created_at,
      reactions: item.reactions || {}
    }));
  },

  /**
   * 真正的雲端同步：上傳圖片到 Storage，然後存入資料庫
   */
  syncWithGlobal: async (imageData: string, location: UserLocation): Promise<WorldMoment[]> => {
    if (!supabase) throw new Error("Supabase client not initialized");

    const fileName = `moment-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    // 1. 上傳至 Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob);

    if (uploadError) throw uploadError;

    // 2. 獲取公開網址
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;

    // 3. 存入 PostgreSQL
    const { error: insertError } = await supabase
      .from('moments')
      .insert({
        image_url: publicUrl,
        location: location,
        reactions: {}
      });

    if (insertError) throw insertError;

    // 4. 返回最新的全球池
    return await momentStore.getMoments();
  },

  /**
   * 獲取除自己之外的交換池
   */
  getExchangePool: async (currentId: string): Promise<WorldMoment[]> => {
    const all = await momentStore.getMoments();
    return all.filter(m => m.id !== currentId);
  }
};
