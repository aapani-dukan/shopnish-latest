// frontend/vite.config.ts (यह फाइल अब 'frontend' फोल्डर में है)

import { defineConfig } from "vite"; // ✅ 'defineConfig' का 'C' capital है
import react from "@vitejs/plugin-react"; // ✅ सही package name '@vitejs/plugin-react'
import path from "path"; // 'path' module को import करना न भूलें

export default defineConfig({ // ✅ 'vite.defineconfig' की जगह 'defineConfig' सीधे उपयोग करें
  plugins: [react()],
  
  // ✅ FIX: Vite को बताएं कि आपका source code 'client' फोल्डर के अंदर है
  // क्योंकि Vercel build कमांड 'frontend' फोल्डर से चलता है,
  // और आपकी index.html 'frontend/client/index.html' पर है,
  // इसलिए 'root' को 'client' पर सेट करना सही है।
  root: 'client', 

  resolve: {
    alias: {
      // ✅ FIX: 'src' फोल्डर के लिए एक स्पष्ट alias 'src' बनाएं
      // क्योंकि 'root: client' सेट है, तो Vite 'frontend/client' को base मानेगा।
      // तो, './src' का मतलब 'frontend/client/src' होगा।
      // आपके Imports '/lib/utils', '/context/locationcontext', '/hooks/useauth' जैसे थे।
      // इसलिए, 'src' alias को 'frontend/client/src' पर मैप करें।
      'src': path.resolve(__dirname, './client/src'), 
      
      // 'shared' फोल्डर 'frontend' के पैरेलल है (frontend/../shared)
      'shared': path.resolve(__dirname, '../shared'), 
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true, // ✅ 'strictPort' का 'P' capital है
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true, // ✅ 'changeOrigin' का 'O' capital है
        secure: false,
      },
    },
  },
  build: {
    // ✅ FIX: 'outDir' कॉन्फ़िगरेशन को बहाल करें और 'outDir', 'emptyOutDir', 'chunkSizeWarningLimit' को ठीक करें
    // 'outDir' वह जगह है जहाँ बिल्ड किए गए static assets जाएंगे।
    // 'frontend/dist/public' में आउटपुट करने के लिए।
    outDir: path.resolve(__dirname, '../dist/public'), 
    emptyOutDir: true, // ✅ 'emptyOutDir' का 'O' capital है
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // ✅ 'chunkSizeWarningLimit' का 'S', 'W', 'L' capital है
  },
  optimizeDeps: {
    include: ["react-google-maps/api"],
  },
});
