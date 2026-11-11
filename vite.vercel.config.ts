import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vercel build: the SPA only. The API is api/index.ts, and nothing here touches
// the Cloudflare plugin, so `npm run dev` / `npm run build` keep working.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true },
})
