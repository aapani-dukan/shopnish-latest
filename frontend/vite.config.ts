// frontend/vite.config.ts

import { defineConfig } from "vite"; // ✅ 'defineConfig' का 'C' capital करें
import react from "@vitejs/plugin-react"; // ✅ सही package name '@vitejs/plugin-react'
import path from "path";

export default defineConfig({
  plugins: [react()],
  
  // ✅ FIX: 'root' को 'client' फोल्डर के सापेक्ष 'frontend/client' के रूप में सेट करें
  // क्योंकि आपकी index.html client फोल्डर के अंदर है और यह vite.config.ts भी client फोल्डर में है,
  // तो 'root: .' का मतलब है कि यह config फाइल जहां है वही रूट है।
  // लेकिन अगर vite आपके main project root (frontend) से चलता है,
  // तो उसे पता होना चाहिए कि index.html 'client' फोल्डर के अंदर है।
  // इस specific situation के लिए, अगर vite.config.ts 'client' के अंदर है, तो 'root: .' सही हो सकता है।
  // लेकिन यह सुनिश्चित करने के लिए कि बिल्ड कमांड कहाँ से चलता है,
  // हम मानेंगे कि बिल्ड कमांड 'frontend' से चलता है और 'client' को root के रूप में बताना होगा।
  root: path.resolve(__dirname), // ✅ यह Vite को बताता है कि रूट फोल्डर वही है जहाँ यह vite.config.ts फाइल है, यानि 'frontend/client'

  resolve: {
    alias: {
      // ✅ 'src' फोल्डर के लिए एक स्पष्ट alias 'src' (या '@') दें
      // '@': path.resolve(__dirname, 'src'), // या 'src' के लिए '@' alias का उपयोग कर सकते हैं
      '~': path.resolve(__dirname, './src'), // ✅ 'src' फोल्डर के लिए alias। '__dirname' client फोल्डर को इंगित करेगा।
      'shared': path.resolve(__dirname, '../../shared'), // ✅ 'frontend/client' से '../../shared' तक पहुँचने के लिए
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true, // ✅ 'strictport' को 'strictPort' करें
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true, // ✅ 'changeorigin' को 'changeOrigin' करें
        secure: false,
      },
    },
  },
  build: {
    // ✅ 'outdir' को 'outDir' करें।
    // 'frontend/client/dist' में बिल्ड करने के लिए path.resolve(__dirname, 'dist') का उपयोग करें।
    // यदि आप 'frontend/dist/public' में बिल्ड करना चाहते हैं, तो path.resolve(__dirname, '../../dist/public') होगा।
    outDir: path.resolve(__dirname, '../../dist/public'), // ✅ सही relative path यदि आप frontend/dist/public चाहते हैं
    emptyOutDir: true, // ✅ 'emptyoutdir' को 'emptyOutDir' करें
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // ✅ 'chunksizewarninglimit' को 'chunkSizeWarningLimit' करें
  },
  optimizeDeps: {
    include: ["react-google-maps/api"],
  },
});
