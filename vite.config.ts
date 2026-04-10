import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'TradeOffice AI',
        short_name: 'TradeOffice',
        description: 'The AI-powered operations platform for trade contractors',
        theme_color: '#1B2B4D',
        background_color: '#1B2B4D',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // NetworkFirst for API/Supabase calls, CacheFirst for static assets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 10 },
          },
          {
            urlPattern: /\.(js|css|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'static-assets', expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || 'tradeoffice-ai',
      project: process.env.SENTRY_PROJECT || 'tradeoffice-app',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
