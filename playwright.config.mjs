import { defineConfig, devices } from '@playwright/test';
const gpu = { channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] };
export default defineConfig({
  testDir: 'qa/tests', timeout: 120_000, fullyParallel: false, workers: 1, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'node qa/serve.mjs 4173', url: 'http://127.0.0.1:4173/__health', reuseExistingServer: true },
  projects: [
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'webkit-ipad', use: { browserName: 'webkit', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'chrome-desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, launchOptions: gpu } },
  ],
});
