import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4178',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/New_York',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
  },
});
