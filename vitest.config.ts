import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        bindings: {
          APP_NAME: "eaglesheet",
          APP_DOMAIN: "eaglesheet.com",
          TURNSTILE_SITE_KEY: "test-only-site-key",
        },
      },
    }),
  ],
  test: {
    testTimeout: 10_000,
  },
});
