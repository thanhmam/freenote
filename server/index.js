// CLI entry: `npm run dev` (Vite hot reload) or `npm start` (production build).
import { startServer } from "./app.js";

const dev = !(process.argv.includes("--prod") || process.env.NODE_ENV === "production");
const { url, dataDir } = await startServer({ port: Number(process.env.PORT) || 3001, host: process.env.HOST || "127.0.0.1", dev });
console.log(`Frnt → ${url}   (data: ${dataDir})`);
