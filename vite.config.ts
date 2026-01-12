
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 將 Vercel 上的環境變數 API_KEY 注入到前端代碼中
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  server: {
    host: true
  }
});
