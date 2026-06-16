import * as Sentry from "@sentry/astro";

const dsn = typeof import.meta.env.SENTRY_DSN === "string" ? import.meta.env.SENTRY_DSN : undefined;
const isDev = import.meta.env.DEV;
const debugEnabled = import.meta.env.SENTRY_DEBUG === "1";

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && (!isDev || debugEnabled),
  dataCollection: { userInfo: false, httpBodies: [] },
  integrations: [Sentry.browserTracingIntegration()],
  enableLogs: true,
  tracesSampleRate: isDev ? 1.0 : 0.1,
});
