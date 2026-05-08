import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_TIME__: JSON.stringify('1970-01-01T00:00:00.000Z'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.test.js', '.claude/**'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
