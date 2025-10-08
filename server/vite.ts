// server/vite.ts
import express, { Express } from 'express';
import { createServer as createViteServer, ViteDevServer } from 'vite';
import compression from 'compression';
import sirv from 'sirv';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

let vite: ViteDevServer;
let prodServeStaticMiddleware: ReturnType<typeof sirv>;

export async function setupVite(app: Express) {
  if (!isProd) {
    // डेवलपमेंट मोड: Vite को मिडलवेयर के रूप में चलाएं
    vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    log('✅ Vite development server active.');
  } else {
    // प्रोडक्शन मोड: compression और sirv के साथ static files सर्व करें
    app.use(compression());

    // Sirv को client/dist के बजाय 'dist/public' में देखना चाहिए,
    // क्योंकि Vite वहीं बिल्ड कर रहा है।
    prodServeStaticMiddleware = sirv('dist/public', { // <--- यहाँ पाथ बदला गया
      etag: true,
      maxAge: 31536000,
      immutable: true,
    });

    app.use(prodServeStaticMiddleware);

    const staticPath = path.resolve(process.cwd(), 'dist', 'public'); // <--- लॉग के लिए पाथ बदला गया
    log(`✅ Serving static assets in production from: ${staticPath}`);
  }
}

export function log(message: string) {
  console.log(message);
}
