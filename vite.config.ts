import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';

export default defineConfig({
  plugins: [react(), {
    name: 'publish-pwa-assets',
    closeBundle() {
      for (const file of ['sw.js', 'manifest.json']) {
        copyFileSync(file, `dist/${file}`);
      }
    }
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000
  }
});
