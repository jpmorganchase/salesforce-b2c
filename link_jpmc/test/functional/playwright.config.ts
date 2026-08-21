import { defineConfig, devices } from '@playwright/test';
import { envConfig, logEnvironmentConfig } from './config/environment';

logEnvironmentConfig();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 3,
  workers: envConfig.isCI ? 1 : 4,
  reporter: 'html',
  use: {
    baseURL: envConfig.baseUrl,
    headless: envConfig.headless,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: envConfig.timeouts.navigation,
    actionTimeout: envConfig.timeouts.action,
  },
  timeout: envConfig.timeouts.default,
  expect: {
    timeout: envConfig.timeouts.expect,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
