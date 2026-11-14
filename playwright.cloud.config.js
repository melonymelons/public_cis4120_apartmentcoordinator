import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  testDir: './supabase/browser-tests',
  outputDir: './test-results/cloud',
  use: { ...config.use, baseURL: 'http://127.0.0.1:5174' },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key' },
  },
});
