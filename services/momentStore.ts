import { createClient } from '@supabase/supabase-js';
import { WorldMoment, UserLocation } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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
    throw new Error("圖片解析失敗");
  }
}

export const momentStore = {
  getMoments: async (): Promise<WorldMoment[]> => {
    if (!supabase) return [];
    try {
      // 強制限制為最新 10 張，保持最鮮活的全球脈動
      const { data, error } = await supabase
        .from('moments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) return [];
      return (data || []).map(item => ({
        id: item.id,
        imageUrl: item.image_url,
        location: item.location,
        timestamp: item.created_at,
        reactions: item.reactions || {}
      }));
    } catch (e) {
      return [];
    }
  },

  syncWithGlobal: async (
    imageData: string, 
    location: UserLocation, 
    onProgress?: (msg: string) => void
  ): Promise<{ moments: WorldMoment[]; selfId: string }> => {
    if (!supabase) throw new Error("Cloud not configured");

    onProgress?.("正在解析視界節點...");
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const blob = base64ToBlob(imageData);

    onProgress?.("同步至全球雲端...");
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    onProgress?.("正在標記全球座標...");
    const { data: insertData, error: insertError } = await supabase
      .from('moments')
      .insert({ image_url: publicUrl, location: location, reactions: {} })
      .select('id')
      .single();

    if (insertError) throw new Error(insertError.message);

    onProgress?.("同步完成...");
    const all = await momentStore.getMoments();
    return { moments: all, selfId: insertData.id };
  }
};