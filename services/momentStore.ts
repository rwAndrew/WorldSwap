
import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 診斷日誌：這會在瀏覽器控制台顯示環境變數是否正確加載（不洩漏完整 Key）
console.log("Supabase 配置檢查:", {
  urlExists: !!supabaseUrl && supabaseUrl !== "null",
  keyExists: !!supabaseAnonKey && supabaseAnonKey !== "null",
  urlPrefix: supabaseUrl?.substring(0, 10)
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
        console.error("獲取資料失敗:", error.message, error.details);
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
      throw new Error("Supabase 未配置。請確認環境變數 SUPABASE_URL 與 SUPABASE_ANON_KEY 已設定。");
    }

    onProgress?.("正在準備圖片節點...");
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    // 1. 上傳到 Storage
    onProgress?.("正在上傳至全球儲存節點...");
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { 
        contentType: 'image/jpeg', 
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Storage 上傳錯誤詳細資訊:", uploadError);
      let msg = "上傳失敗。";
      if (uploadError.message.includes("not found")) {
        msg += ` 找不到儲存桶 "${BUCKET_NAME}"，請在 Supabase 建立它。`;
      } else if (uploadError.message.includes("Row-level security")) {
        msg += " RLS 政策拒絕寫入，請確認 Storage 政策已設為允許匿名 Insert。";
      } else {
        msg += ` 原因: ${uploadError.message}`;
      }
      throw new Error(msg);
    }

    // 2. 獲取公開網址
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    console.log("圖片已上傳，網址:", publicUrl);

    // 3. 寫入資料表
    onProgress?.("正在寫入交換資料庫...");
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
      console.error("資料庫寫入錯誤詳細資訊:", insertError);
      throw new Error(`資料庫寫入失敗: ${insertError.message}。請確認 'moments' 表存在且 RLS 已開啟。`);
    }

    onProgress?.("同步完成！獲取全球視界中...");
    const all = await momentStore.getMoments();
    return { moments: all, selfId: insertData.id };
  }
};
