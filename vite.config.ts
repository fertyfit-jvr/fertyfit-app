import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    // En desarrollo local, las funciones serverless se ejecutan localmente
    // No necesitamos proxy si estamos ejecutando las funciones localmente
    // Si necesitas probar contra producción, descomenta el proxy:
    // proxy: {
    //   '/api/ocr': {
    //     target: 'https://method.fertyfit.com',
    //     changeOrigin: true,
    //     secure: true,
    //     rewrite: (path) => path,
    //   },
    // },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['lucide-react'],
          'data-vendor': ['@supabase/supabase-js', 'zustand'],
          'chart-vendor': ['recharts'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Ensure CSS is included in build
    cssCodeSplit: false,
  },
  // Ensure CSS is processed correctly
  css: {
    postcss: './postcss.config.js',
  },
});