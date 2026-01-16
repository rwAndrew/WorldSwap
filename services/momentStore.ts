
import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : null;

const BUCKET_NAME = 'moment-photos';

function base64ToBlob(base64: string, contentType: string = 'image/jpeg') {
  try {
    const splitData = base64.split(',');
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
    throw new Error("圖片轉換失敗");
  }
}

export const momentStore = {
  getMoments: async (): Promise<WorldMoment[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('moments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return [];
    return (data || []).map(item => ({
      id: item.id,
      imageUrl: item.image_url,
      location: item.location,
      timestamp: item.created_at,
      reactions: item.reactions || {}
    }));
  },

  syncWithGlobal: async (
    imageData: string, 
    location: UserLocation, 
    onProgress?: (msg: string) => void
  ): Promise<{ moments: WorldMoment[]; selfId: string }> => {
    if (!supabase) throw new Error("環境變數缺失");

    onProgress?.("正在處理圖片...");
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    onProgress?.("正在上傳至雲端儲存...");
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if (uploadError) {
      console.error("Storage Error:", uploadError);
      throw new Error(`上傳失敗: ${uploadError.message} (請確認 Bucket "${BUCKET_NAME}" 已建立且設為 Public)`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    onProgress?.("正在寫入全球資料庫...");
    const { data: insertData, error: insertError } = await supabase
      .from('moments')
      .insert({ image_url: publicUrl, location: location, reactions: {} })
      .select('id')
      .single();

    if (insertError) {
      console.error("DB Insert Error:", insertError);
      throw new Error(`寫入失敗: ${insertError.message}`);
    }

    onProgress?.("同步完成，正在獲取交換視界...");
    const all = await momentStore.getMoments();
    return { moments: all, selfId: insertData.id };
  }
};
