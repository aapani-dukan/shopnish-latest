// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {  
    
      "@": path.resolve(__dirname, "src"),       // ✅ client/src
      "@shared": path.resolve(__dirname, '..', 'shared'), // ✅ root/shared
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000", // Express backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'dist/public'), // ✅ same as server expects
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
  },
}); 
