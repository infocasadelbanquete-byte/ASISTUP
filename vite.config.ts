import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const stampServiceWorkerPlugin = () => ({
  name: 'stamp-service-worker-build-id',
  closeBundle() {
    const swOutPath = path.resolve(process.cwd(), 'dist', 'sw.js');
    if (fs.existsSync(swOutPath)) {
      const buildId = Date.now().toString(36);
      const raw = fs.readFileSync(swOutPath, 'utf8');
      const stamped = raw.replace(/__SW_BUILD_ID__/g, buildId);
      fs.writeFileSync(swOutPath, stamped, 'utf8');
    }
  }
});

export default defineConfig({
  plugins: [react(), stampServiceWorkerPlugin()],
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
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true'
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true
  }
});