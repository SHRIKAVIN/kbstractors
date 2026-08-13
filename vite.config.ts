import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      // The existing public/manifest.json + index.html <link rel="manifest"> stay as-is —
      // this plugin is only used to build the service worker for Web Push.
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Bundle includes jspdf/pdfmake/xlsx — default 2 MiB would omit the main
        // chunk from the SW precache.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      // injectManifest SW uses ESM imports; Vite's module SW is Chromium-only and
      // often throws "Cannot use import statement outside a module" in local dev.
      // Use `vite preview` (or production) to exercise the service worker.
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
