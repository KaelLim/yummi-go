import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.test.js', '.claude/**'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
