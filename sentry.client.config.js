import * as Sentry from "@sentry/astro";
import { SENTRY_DSN, SENTRY_DEBUG } from "astro:env/client";

const isDev = import.meta.env.DEV;
const debugEnabled = SENTRY_DEBUG === "1";

const UUID_PATH_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

Sentry.init({
  dsn: SENTRY_DSN,
  tunnel: "/api/sentry-tunnel",
  enabled: Boolean(SENTRY_DSN) && (!isDev || debugEnabled),
  environment: isDev ? "development" : "production",
  dataCollection: { userInfo: false, httpBodies: [] },
  integrations: [Sentry.browserTracingIntegration()],
  enableLogs: true,
  tracesSampleRate: isDev ? 1.0 : 0.1,
  beforeSendTransaction(event) {
    if (typeof event.transaction === "string") {
      event.transaction = event.transaction.replace(UUID_PATH_SEGMENT, "/:id");
    }
    return event;
  },
});
