import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    define: {
      'process.env': {}
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        base: './',
        manifest: {
          name: 'SCRIPTIA',
          short_name: 'SCRIPTIA',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'landscape',
          background_color: '#0a0e17',
          theme_color: '#0a0e17',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          cleanupOutdatedCaches: true, // 古いキャッシュを即時破棄
          clientsClaim: true,
          skipWaiting: true // 新しいService Workerを待機させず即座に有効化
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
