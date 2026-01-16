
import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 診斷日誌：這會在瀏覽器控制台顯示環境變數是否正確加載
console.log("Supabase 配置檢查:", {
  urlExists: !!supabaseUrl && supabaseUrl !== "undefined" && supabaseUrl !== "null",
  keyExists: !!supabaseAnonKey && supabaseAnonKey !== "undefined" && supabaseAnonKey !== "null",
});

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "null" && 
  supabaseUrl !== "undefined" &&
  supabaseUrl.startsWith('https://')
);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : null;

const BUCKET_NAME = 'moment-photos';

function base64ToBlob(base64: string, contentType: string = 'image/jpeg') {
  try {
    const splitData = base64.split(',');
    if (splitData.length < 2) throw new Error("無效的 Base64 數據格式");
    const byteCharacters = atob(splitData[1]);
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
  } catch (e) {
    console.error("Blob 轉換失敗:", e);
    throw new Error("圖片數據損壞，請嘗試重新拍攝。");
  }
}

export const momentStore = {
  getMoments: async (): Promise<WorldMoment[]> => {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('moments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error("獲取資料失敗:", error.message);
        return [];
      }
      return (data || []).map(item => ({
        id: item.id,
        imageUrl: item.image_url,
        location: item.location,
        timestamp: item.created_at,
        reactions: item.reactions || {}
      }));
    } catch (e) {
      console.error("Supabase 查詢異常:", e);
      return [];
    }
  },

  syncWithGlobal: async (
    imageData: string, 
    location: UserLocation, 
    onProgress?: (msg: string) => void
  ): Promise<{ moments: WorldMoment[]; selfId: string }> => {
    if (!supabase) {
      throw new Error("Supabase 未配置。請確認環境變數已在部署平台設定。");
    }

    onProgress?.("正在處理圖片...");
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    // 1. 上傳到 Storage
    onProgress?.("正在上傳至雲端...");
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { 
        contentType: 'image/jpeg', 
        upsert: false
      });

    if (uploadError) {
      console.error("Storage 錯誤:", uploadError);
      throw new Error(`上傳失敗: ${uploadError.message}。請確認 Storage Bucket "${BUCKET_NAME}" 已建立並設為 Public。`);
    }

    // 2. 獲取網址
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // 3. 寫入資料表
    onProgress?.("正在同步視界...");
    const { data: insertData, error: insertError } = await supabase
      .from('moments')
      .insert({ 
        image_url: publicUrl, 
        location: location, 
        reactions: {} 
      })
      .select('id')
      .single();

    if (insertError) {
      console.error("DB 錯誤:", insertError);
      throw new Error(`資料庫寫入失敗: ${insertError.message}。請確認 'moments' 表的 RLS 政策已設為允許 Insert。`);
    }

    onProgress?.("完成交換！");
    const all = await momentStore.getMoments();
    return { moments: all, selfId: insertData.id };
  }
};
