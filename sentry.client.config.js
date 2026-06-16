import * as Sentry from "@sentry/astro";
import { SENTRY_DSN, SENTRY_DEBUG } from "astro:env/client";

const isDev = import.meta.env.DEV;
const debugEnabled = SENTRY_DEBUG === "1";

Sentry.init({
  dsn: SENTRY_DSN,
  tunnel: "/api/sentry-tunnel",
  enabled: Boolean(SENTRY_DSN) && (!isDev || debugEnabled),
  environment: isDev ? "development" : "production",
  dataCollection: { userInfo: false, httpBodies: [] },
  integrations: [Sentry.browserTracingIntegration()],
  enableLogs: true,
  tracesSampleRate: isDev ? 1.0 : 0.1,
});
