import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version),
  },
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'], env: { TZ: 'America/New_York' } },
});
