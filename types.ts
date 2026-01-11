
export interface WorldMoment {
  id: string;
  imageUrl: string;
  location: {
    city: string;
    country: string;
    city_zh: string;
    country_zh: string;
    lat: number;
    lng: number;
  };
  timestamp: string;
  caption?: string;
  reactions: Record<string, number>;
}

export enum AppState {
  LANDING = 'LANDING',
  CAPTURING = 'CAPTURING',
  UPLOADING = 'UPLOADING',
  SWIPING = 'SWIPING',
  SUMMARY = 'SUMMARY'
}

export interface UserLocation {
  city: string;
  country: string;
  city_zh: string;
  country_zh: string;
  lat: number;
  lng: number;
}

export type Language = 'en' | 'zh';
