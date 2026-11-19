import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8510' } },
  build: {rollupOptions: {
    input: {
      workspace: fileURLToPath(new URL('./index.html', import.meta.url)),
      demo: fileURLToPath(new URL('./demo.html', import.meta.url)),
    },
    output: {manualChunks(id) {
    if (id.includes('node_modules') && /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
    if (id.includes('node_modules') && /recharts|d3-|victory-vendor/.test(id)) return 'charts';
  }}}},
});
