import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The dev server proxies API and uploaded-file requests to the Express backend,
// so the browser sees one origin and the auth cookie works without CORS issues.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/uploads": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
