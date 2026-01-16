
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 確保即使變數為空也會注入 null 而非字串 "undefined"
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || null),
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || null),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || null),
  },
  server: {
    host: true,
    fs: {
      strict: false // 允許存取根目錄檔案如 logo.svg
    }
  }
});
