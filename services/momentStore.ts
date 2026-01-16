
import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

// 安全地獲取環境變數，若不存在則為 undefined
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 檢查配置是否完整
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));

// 只有在 URL 有效時才建立客戶端，否則保持為 null
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : null;

const BUCKET_NAME = 'moment-photos';

function base64ToBlob(base64: string, contentType: string = 'image/jpeg') {
  try {
    const splitData = base64.split(',');
    if (splitData.length < 2) throw new Error("無效的 Base64 格式");
    
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
    console.error("Base64 conversion failed", e);
    throw new Error("圖片格式轉換失敗");
  }
}

export const momentStore = {
  getMoments: async (): Promise<WorldMoment[]> => {
    if (!supabase) {
      console.warn("Supabase not configured, returning empty list");
      return [];
    }

    const { data, error } = await supabase
      .from('moments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error("Supabase Fetch Error:", error.message);
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

  syncWithGlobal: async (imageData: string, location: UserLocation): Promise<WorldMoment[]> => {
    if (!supabase) {
      throw new Error("Supabase 未配置。請在環境變數中設定 SUPABASE_URL 和 SUPABASE_ANON_KEY。");
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    // 1. 上傳檔案 (這是最容易報 404 或權限錯誤的地方)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("【Supabase Storage 錯誤】:", uploadError.message);
      throw new Error(`上傳至儲存空間失敗: ${uploadError.message}。請確保已建立名為 '${BUCKET_NAME}' 的 Public Bucket。`);
    }

    // 2. 獲取網址
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;

    // 3. 寫入資料庫
    const { error: insertError } = await supabase
      .from('moments')
      .insert({
        image_url: publicUrl,
        location: location,
        reactions: {}
      });

    if (insertError) {
      console.error("【Supabase Database 錯誤】:", insertError.message);
      throw new Error(`寫入資料庫失敗: ${insertError.message}`);
    }

    console.log("✅ 雲端同步成功:", publicUrl);
    return await momentStore.getMoments();
  }
};
