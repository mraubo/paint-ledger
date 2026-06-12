import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    test: {
      environment: "node",
      // Integration suites share mutable seed data (ENTRY_A); run files sequentially.
      fileParallelism: false,
      include: ["tests/**/*.test.ts"],
      env: {
        SUPABASE_URL: env.SUPABASE_URL,
        SUPABASE_KEY: env.SUPABASE_KEY,
        APP_URL: env.APP_URL || "http://localhost:4321",
      },
    },
  };
});
