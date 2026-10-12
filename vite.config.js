import { defineConfig } from 'vite';
export default defineConfig({
  root: 'dist/web',
  base: process.env.SAOLA_DIST_BASE_URL || '/',
  server: { host: '127.0.0.1', port: 5556, strictPort: true, fs: { strict: true } },
});
