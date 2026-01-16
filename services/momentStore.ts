import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 診斷：將配置狀態輸出到控制台，確保環境變數已正確注入
console.debug("Supabase 初始化檢查:", {
  url: supabaseUrl && supabaseUrl !== "undefined" ? `${supabaseUrl.substring(0, 15)}...` : "缺少 URL",
  key: supabaseAnonKey && supabaseAnonKey !== "undefined" ? "Key 已存在" : "缺少 Key"
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
    const parts = base64.split(',');
    const byteString = parts.length > 1 ? atob(parts[1]) : atob(parts[0]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: contentType });
  } catch (e) {
    console.error("Blob 轉換失敗:", e);
    throw new Error("圖片數據解析失敗，請嘗試重新拍攝");
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
        console.error("獲取資料錯誤:", error.message);
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
      console.error("查詢異常:", e);
      return [];
    }
  },

  syncWithGlobal: async (
    imageData: string, 
    location: UserLocation, 
    onProgress?: (msg: string) => void
  ): Promise<{ moments: WorldMoment[]; selfId: string }> => {
    if (!supabase) {
      throw new Error("Supabase 未正確配置。請在部署環境中設定 SUPABASE_URL 與 SUPABASE_ANON_KEY。");
    }

    onProgress?.("正在處理圖片節點...");
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    // 第一階段：上傳照片到 Storage
    onProgress?.("正在同步至全球雲端...");
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { 
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false 
      });

    if (uploadError) {
      console.error("Storage 上傳失敗詳情:", uploadError);
      throw new Error(`[上傳失敗] ${uploadError.message}。請確認 Storage Bucket "${BUCKET_NAME}" 已建立並設為 Public。`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // 第二階段：寫入資料庫
    onProgress?.("正在登記視界座標...");
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
      console.error("Database 寫入失敗詳情:", insertError);
      throw new Error(`[資料庫錯誤] ${insertError.message}。請確認 'moments' 表格已開啟 RLS 政策。`);
    }

    onProgress?.("交換完成，正在更新視界...");
    const all = await momentStore.getMoments();
    return { moments: all, selfId: insertData.id };
  }
};