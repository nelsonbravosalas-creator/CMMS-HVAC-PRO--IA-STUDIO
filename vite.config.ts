import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const disablePwa = env.VITE_DISABLE_PWA === 'true' || env.DISABLE_PWA === 'true' || process.env.DISABLE_PWA === 'true';
  return {
    plugins: [
      react(), 
      tailwindcss(),
      !disablePwa && VitePWA({
        // Una versión nueva espera a que se cierren las pestañas de la versión
        // anterior. Así cada cliente usa un conjunto coherente de chunks y la
        // actualización se activa al volver a abrir la PWA.
        registerType: 'prompt',
        useCredentials: true,
        devOptions: {
          enabled: false
        },
        manifest: {
          name: 'CMMS HVAC PRO',
          short_name: 'HVAC Pro',
          description: 'Gestión de Activos y Mantenimiento HVAC',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: '/icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        },
        workbox: {
          // Cada service worker conserva el shell y todos los chunks de su
          // propia versión. La versión siguiente no toma control de pestañas
          // abiertas, evitando mezclar módulos de despliegues distintos.
          globPatterns: ['**/*.{html,js,css,png,svg,ico,woff,woff2,webmanifest}'],
          maximumFileSizeToCacheInBytes: 5000000,
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <--- 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
