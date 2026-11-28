import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./stack",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: process.env.STACK_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
  },
});
