
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getLocationName(lat: number, lng: number): Promise<{ city: string; country: string; city_zh: string; country_zh: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the approximate City and Country for these coordinates: Lat ${lat}, Lng ${lng}. Return the names in both English and Traditional Chinese (Taiwan variant) as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING },
            country: { type: Type.STRING },
            city_zh: { type: Type.STRING },
            country_zh: { type: Type.STRING }
          },
          required: ["city", "country", "city_zh", "country_zh"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (e) {
    return { 
      city: "Unknown City", 
      country: "Unknown Country",
      city_zh: "未知城市",
      country_zh: "未知國家"
    };
  }
}

/**
 * 模擬全球交換流
 * 當本地存儲為空時，從 Gemini 獲取 5 個虛構但真實的地點瞬間
 */
export async function fetchGlobalSimulatedMoments(): Promise<any[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate 5 diverse, realistic global 'moments' from different time zones. Each should have a city, country, and a specific local time. Output as JSON array.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              country: { type: Type.STRING },
              city_zh: { type: Type.STRING },
              country_zh: { type: Type.STRING },
              timestamp: { type: Type.STRING, description: "ISO string" }
            },
            required: ["city", "country", "city_zh", "country_zh", "timestamp"]
          }
        }
      }
    });
    const mockData = JSON.parse(response.text);
    // 為這些數據配上高品質的世界攝影圖庫鏈接 (Unsplash Source)
    return mockData.map((item: any, index: number) => ({
      id: `sim-${index}-${Date.now()}`,
      imageUrl: `https://images.unsplash.com/photo-${[
        '1514933651103-005eec06c04b', // 巴黎
        '1506973035872-a4ec16b8e8d9', // 悉尼
        '1449034446853-66c86144b0ad', // 三藩市
        '1513635269975-59663e0ac1ad', // 倫敦
        '1503899036084-755a30bb7ac9'  // 東京
      ][index]}?auto=format&fit=crop&w=1080&q=80`,
      location: item,
      timestamp: item.timestamp,
      reactions: {}
    }));
  } catch (e) {
    return [];
  }
}
