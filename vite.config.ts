import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'suppress-vite-client-reload',
        transform(code, id) {
          if (code.includes('location.reload()') || code.includes('vite:ws:disconnect')) {
            return code.replace(
              /await waitForSuccessfulPing\(url\.href\);\s*location\.reload\(\);/g,
              'console.warn("[vite] Conexión reiniciada, recarga automática suprimida.");'
            ).replace(
              /location\.reload\(\);/g,
              'console.warn("[vite] Recarga automática suprimida.");'
            );
          }
          return code;
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon-v2.png', 'apple-touch-icon-v2.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Registro de Garantía de Terrenos',
          short_name: 'Garantías',
          description: 'Sistema administrativo para el registro y control de bienes y parcelas dados en garantía - Asoc. Civil Colonia Chihuahua',
          theme_color: '#1b4332',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192-v2.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512-v2.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512-v2.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio preview to prevent WebSocket resets and automatic reload loops
      hmr: false,
      watch: {
        ignored: ['**/dist/**', '**/dev-dist/**', '**/.git/**', '**/*.bak*'],
      },
    },
  };
});
