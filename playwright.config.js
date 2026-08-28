import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './site-tests',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true } }
  ]
});
