import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3010",
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } } },
    { name: "mobile-390", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-360-light", use: { ...devices["Pixel 5"], colorScheme: "light", viewport: { width: 360, height: 800 } } },
    { name: "mobile-390-light", use: { ...devices["Pixel 5"], colorScheme: "light", viewport: { width: 390, height: 844 } } },
    { name: "tablet-768-light", use: { ...devices["Desktop Chrome"], colorScheme: "light", viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1024-light", use: { ...devices["Desktop Chrome"], colorScheme: "light", viewport: { width: 1024, height: 768 } } },
    { name: "desktop-1440-light", use: { ...devices["Desktop Chrome"], colorScheme: "light", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command:
      "PAYNA_UI_FIXTURE=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run dev -- --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010/dev/ui-preview",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
