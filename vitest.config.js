import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    include: ['resources/saola/web/app/game/**/*.test.js', 'tests/**/*.test.js'],
    testTimeout: 180000,
    hookTimeout: 180000,
    maxWorkers: 1,
  },
});
