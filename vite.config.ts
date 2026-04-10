import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['aws-amplify', 'aws-amplify/auth', 'aws-amplify/api', 'aws-amplify/utils'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'aws-amplify': ['aws-amplify', 'aws-amplify/auth', 'aws-amplify/api'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
