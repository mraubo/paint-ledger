import * as Sentry from "@sentry/cloudflare";
import astroHandler from "@astrojs/cloudflare/entrypoints/server";

interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_DEBUG?: string;
}

const UUID_PATH_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function sanitizeTransactionName(name: string): string {
  return name.replace(UUID_PATH_SEGMENT, "/:id");
}

function sentryOptions(env: SentryEnv) {
  const dsn = env.SENTRY_DSN;
  const isProd = import.meta.env.PROD;
  const debugEnabled = env.SENTRY_DEBUG === "1";

  return {
    dsn,
    enabled: Boolean(dsn) && (isProd || debugEnabled),
    environment: isProd ? "production" : "development",
    dataCollection: { userInfo: false, httpBodies: [] },
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
    enableLogs: true,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    beforeSendTransaction(event: { transaction?: string }) {
      if (event.transaction) {
        event.transaction = sanitizeTransactionName(event.transaction);
      }
      return event;
    },
  };
}

export default Sentry.withSentry(sentryOptions, astroHandler);
