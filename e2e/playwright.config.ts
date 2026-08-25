import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm --filter web dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    cwd: "..",
  },
});
