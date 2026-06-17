import type { APIRoute } from "astro";
import * as Sentry from "@sentry/cloudflare";

function isSentryDebugRouteAllowed(): boolean {
  return !import.meta.env.PROD && process.env.SENTRY_DEBUG === "1";
}

export const POST: APIRoute = async () => {
  if (!isSentryDebugRouteAllowed()) {
    return new Response(null, { status: 404 });
  }

  const eventId = Sentry.captureException(new Error("This is a test error (server)"));
  await Sentry.flush(2000);

  return new Response(JSON.stringify({ ok: true, eventId, target: "server" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
