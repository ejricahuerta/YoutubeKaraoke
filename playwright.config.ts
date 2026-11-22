import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

/**
 * Browser tests for the screens. They run against a production build with the session API
 * answered by fixtures (e2e/session.ts), so no Supabase project and no YouTube are needed.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    // A closed local port: the pages only need the variables to exist, and anything that does call the database fails at once.
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder" },
  },
});
