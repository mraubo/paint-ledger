// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

import sentry from "@sentry/astro";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    react(),
    sitemap(),
    sentry({
      org: "mraubo",
      project: "paint-ledger",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Server SDK is initialized in sentry.server.config.ts (Cloudflare Worker entry).
      enabled: { server: false },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_DSN: envField.string({ context: "client", access: "public", optional: true }),
      SENTRY_DEBUG: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
});
