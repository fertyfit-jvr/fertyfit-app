import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin para interceptar y bloquear llamadas a /api/gemini/*
const blockGeminiPlugin = () => {
  return {
    name: 'block-gemini-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', (req, res, next) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Endpoint no disponible - Gemini ha sido removido',
          code: 'GEMINI_REMOVED'
        }));
      });
    },
  };
};

export default defineConfig({
  plugins: [react(), blockGeminiPlugin()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    // Proxy para redirigir llamadas a /api/ocr a Vercel en desarrollo
    proxy: {
      '/api/ocr': {
        target: 'https://method.fertyfit.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path, // Mantener la ruta original
      },
    },
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