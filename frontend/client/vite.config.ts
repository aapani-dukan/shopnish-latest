// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {  
      "@": path.resolve(__dirname, "src"),
      "shared": path.resolve(__dirname, '..', 'shared'),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true, // Corrected: strictPort
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true, // Corrected: changeOrigin
        secure: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'dist/public'), // Corrected: outDir
    emptyOutDir: true, // Corrected: emptyOutDir
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Corrected: chunkSizeWarningLimit
  },
  // यह सुनिश्चित करने के लिए कि Vite '@react-google-maps/api' को सही ढंग से ऑप्टिमाइज करे
  optimizeDeps: {
    include: ['@react-google-maps/api'],
  },
});
