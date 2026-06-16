import * as Sentry from "@sentry/cloudflare";
import astroHandler from "@astrojs/cloudflare/entrypoints/server";

interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_DEBUG?: string;
}

function sentryOptions(env: SentryEnv) {
  const dsn = env.SENTRY_DSN;
  const isProd = import.meta.env.PROD;
  const debugEnabled = env.SENTRY_DEBUG === "1";

  return {
    dsn,
    enabled: Boolean(dsn) && (isProd || debugEnabled),
    dataCollection: { userInfo: false, httpBodies: [] },
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
    enableLogs: true,
    tracesSampleRate: isProd ? 0.1 : 1.0,
  };
}

export default Sentry.withSentry(sentryOptions, astroHandler);
