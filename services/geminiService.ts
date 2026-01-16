
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 驗證照片真實性 (Gemini Vision)
 * 確保照片是真實現場拍攝，而非螢幕翻拍或素材圖
 */
export async function verifyAuthenticity(base64Image: string): Promise<{ isReal: boolean; reason: string }> {
  try {
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image.split(',')[1]
      }
    };
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          imagePart,
          { text: "Analyze this image. Is it a real, raw smartphone photo of a scene? Or is it a stock photo, a screenshot, or a photo of a screen? Return JSON: { \"isReal\": boolean, \"reason\": \"string\" }" }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Verification error", e);
    // 安全起見，API 失敗時預設通過，但需記錄
    return { isReal: true, reason: "Verification bypassed due to API error" };
  }
}

export async function getLocationName(lat: number, lng: number): Promise<{ city: string; country: string; city_zh: string; country_zh: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Location coordinates: Lat ${lat}, Lng ${lng}. Return JSON with city, country, city_zh, country_zh in Traditional Chinese.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING },
            country: { type: Type.STRING },
            city_zh: { type: Type.STRING },
            country_zh: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (e) {
    return { city: "Earth", country: "Global", city_zh: "地球", country_zh: "全球" };
  }
}

export async function fetchGlobalSimulatedMoments(): Promise<any[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "List 5 active global locations with unique visual styles (JSON: city, country, city_zh, country_zh, keyword).",
      config: { responseMimeType: "application/json" }
    });
    
    const mockData = JSON.parse(response.text);
    return mockData.map((item: any, index: number) => ({
      id: `global-${index}-${Math.random().toString(36).slice(2)}`,
      imageUrl: `https://images.unsplash.com/photo-${[
        '1514933651103-005eec06c04b', '1506973035872-a4ec16b8e8d9', '1449034446853-66c86144b0ad',
        '1513635269975-59663e0ac1ad', '1503899036084-755a30bb7ac9'
      ][index % 5]}?auto=format&fit=crop&w=1080&q=80`,
      location: { ...item, lat: 0, lng: 0 },
      timestamp: new Date().toISOString(),
      reactions: {}
    }));
  } catch (e) {
    return [];
  }
}
