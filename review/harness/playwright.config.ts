import { defineConfig } from "@playwright/test";

// Uses the Chromium already on this machine. Elsewhere, delete executablePath and run
// `npx playwright install chromium` once.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    viewport: { width: 1200, height: 800 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
});
