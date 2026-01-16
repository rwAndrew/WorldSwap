
import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const BUCKET_NAME = 'moment-photos';

function base64ToBlob(base64: string, contentType: string = 'image/jpeg') {
  try {
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
  } catch (e) {
    console.error("Base64 conversion failed", e);
    throw new Error("圖片格式轉換失敗");
  }
}

export const momentStore = {
  getMoments: async (): Promise<WorldMoment[]> => {
    if (!supabase) return [];

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
    if (!supabase) throw new Error("Supabase 未配置 URL 或 Key");

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    // 1. 上傳檔案
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error("【Storage 上傳失敗】:", uploadError.message);
      console.error("請檢查是否已建立名為 'moment-photos' 的 Public Bucket 並設定 RLS Policy");
      throw new Error(`圖片上傳失敗: ${uploadError.message}`);
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
      console.error("【Database 寫入失敗】:", insertError.message);
      throw new Error(`資料記錄失敗: ${insertError.message}`);
    }

    console.log("✅ 成功同步至雲端:", publicUrl);
    return await momentStore.getMoments();
  }
};
