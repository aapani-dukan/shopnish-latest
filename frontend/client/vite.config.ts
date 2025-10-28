import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: ".", // ✅ यह जोड़ना जरूरी है ताकि Vite को पता हो कि index.html root में या client में कहाँ है
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "shared": path.resolve(__dirname, "../shared"), // ✅ path.resolve का सही syntax
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
    outDir: path.resolve(__dirname, "../dist/public"), // ✅ सही absolute path
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ["@react-google-maps/api"],
  },
});