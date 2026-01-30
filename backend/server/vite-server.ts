/// server/vite-server.ts
import express, { Express } from 'express';
// ✅ अब नाम अलग है, तो 'vite' आराम से इम्पोर्ट होगा
import { createServer, type ViteDevServer } from 'vite'; 
import compression from 'compression';
import sirv from 'sirv';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

let viteInstance: ViteDevServer; 

export async function setupVite(app: Express) {
  if (!isProd) {
    // 🛠️ डेवलपमेंट मोड
    viteInstance = await createServer({
      server: {
        middlewareMode: true,
      },
      appType: 'custom',
    });
    
    app.use(viteInstance.middlewares);
    log('🚀 Vite development server active.');
 } else {
    // ✅ 'unknown' के ज़रिए 'any' या 'Handler' में बदलें, ये झगड़ा खत्म कर देगा
    app.use((compression() as unknown) as express.Handler);

    const publicPath = path.resolve(process.cwd(), 'dist', 'public');
    
    const prodServeStaticMiddleware = sirv(publicPath, {
      etag: true,
      maxAge: 31536000,
      immutable: true,
      single: true,
    });

    // ✅ यहाँ भी वही 'unknown' वाला जादू
    app.use((prodServeStaticMiddleware as unknown) as express.Handler);

    log(`✅ Serving static assets in production from: ${publicPath}`);
  } 
}

export function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}