import { defineConfig } from '@playwright/test';
import config from './playwright.cloud.config';
import { mobileProjects } from './playwright.mobile.config';

export default defineConfig({ ...config, workers: 2, outputDir: 'test-results/cloud-mobile', projects: mobileProjects });
