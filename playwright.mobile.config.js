import { defineConfig, devices } from '@playwright/test';
import config from './playwright.config';

export const mobileProjects = [
  { name: 'mobile-safari', use: { ...devices['iPhone 13'], browserName: 'webkit', launchOptions: {} } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'], browserName: 'chromium', launchOptions: config.use.launchOptions } },
];
export default defineConfig({ ...config, workers: 2, outputDir: 'test-results/mobile', projects: mobileProjects });
