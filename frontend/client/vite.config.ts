// frontend/client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname), // ✅ index.html यही folder में है
  plugins: [react()],
  resolve: {
    alias: {  
      "@": path.resolve(__dirname, "src"),
      shared: path.resolve(__dirname, "..", "shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../../dist/public"), // ✅ दो लेवल ऊपर क्योंकि frontend/client से बाहर निकलना है
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ["@react-google-maps/api"],
  },
});
