
import { GoogleGenAI, Type } from "@google/genai";

// Always initialize GoogleGenAI with a named parameter for apiKey using process.env.API_KEY
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
    // response.text is a getter property that returns the string output directly
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
