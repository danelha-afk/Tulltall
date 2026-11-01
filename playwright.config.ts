import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `rm -rf .data/pglite-e2e && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PGLITE_DIR: ".data/pglite-e2e",
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-123",
      ADMIN_PASSWORD: "e2e-admin-passord",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      MIN_ANSWER_MS: "0",
    },
  },
});
