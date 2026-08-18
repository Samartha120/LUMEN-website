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
      // Samartha's backend, mounted alongside the main one. It runs its own
      // schema and database on :4001, so it is reached under /legacy rather
      // than sharing /api — the two speak different shapes (trackingId vs ref,
      // latitude vs lat) and merging the namespaces would break both.
      "/legacy": {
        target: "http://localhost:4001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/legacy/, ""),
      },
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
