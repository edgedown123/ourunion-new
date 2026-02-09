
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // 덩치 제한을 1000KB(1MB)로 높여서 경고를 제거합니다.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 라이브러리들을 별도 묶음으로 분리하여 성능을 최적화합니다.
            return 'vendor';
          }
        },
      },
    },
  },
});
