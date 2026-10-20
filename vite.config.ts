import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `npm run dev` only: serve the Vercel functions in api/ from the Vite dev
 * server, so /api/user-control etc. work locally without `vercel dev`.
 * Production is untouched — Vercel deploys api/*.ts as real functions.
 */
function devApi(): Plugin {
  return {
    name: 'kbs-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Server-side env (SUPABASE_SERVICE_ROLE_KEY, VAPID_*, …) from .env / .env.local.
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = url.pathname.match(/^\/api\/([a-z0-9-]+)\/?$/);
        const file = match ? resolve(process.cwd(), 'api', `${match[1]}.ts`) : null;
        if (!file || !existsSync(file)) return next();

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: unknown = raw || undefined;
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            /* not JSON — leave as text */
          }

          // Minimal Vercel-style req/res on top of Node's.
          let statusCode = 200;
          const vercelReq = Object.assign(req, { body, query: Object.fromEntries(url.searchParams) });
          const vercelRes = {
            status(code: number) {
              statusCode = code;
              return vercelRes;
            },
            setHeader(name: string, value: string) {
              res.setHeader(name, value);
              return vercelRes;
            },
            json(payload: unknown) {
              res.statusCode = statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
              return vercelRes;
            },
            send(payload: unknown) {
              res.statusCode = statusCode;
              res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
              return vercelRes;
            },
            end(payload?: string) {
              res.statusCode = statusCode;
              res.end(payload);
              return vercelRes;
            },
          };

          const mod = await server.ssrLoadModule(file);
          await mod.default(vercelReq, vercelRes);
        } catch (err) {
          if (err instanceof Error) server.ssrFixStacktrace(err);
          console.error(`[dev-api] /api/${match?.[1]} failed:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Dev API error' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    devApi(),
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
