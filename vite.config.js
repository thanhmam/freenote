import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev runs through the Express server (server/index.js) as middleware — single port 3001.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2000 },
});
