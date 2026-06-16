import type { APIRoute } from "astro";

// Sentry tunnel: proxies browser SDK events server-side to bypass CORS and ad-blockers.
// See https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option

const SENTRY_HOST = "o4511574151069696.ingest.de.sentry.io";
const SENTRY_PROJECT_ID = "4511574153494614";

export const POST: APIRoute = async ({ request }) => {
  try {
    const envelope = await request.text();
    const firstLine = envelope.split("\n")[0] ?? "";
    const header = JSON.parse(firstLine) as Record<string, unknown>;
    const dsn = typeof header.dsn === "string" ? new URL(header.dsn) : null;

    if (dsn?.hostname !== SENTRY_HOST) {
      return new Response("Invalid DSN", { status: 400 });
    }

    const projectId = dsn.pathname.replace("/", "");
    if (projectId !== SENTRY_PROJECT_ID) {
      return new Response("Invalid project", { status: 400 });
    }

    const upstream = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: envelope,
    });

    return new Response(await response.text(), { status: response.status });
  } catch {
    return new Response("Tunnel error", { status: 500 });
  }
};
