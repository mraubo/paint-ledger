import type { APIRoute } from "astro";

// Sentry tunnel: proxies browser SDK events server-side to bypass CORS and ad-blockers.
// See https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option

function getAllowedTunnelTarget(): { host: string; projectId: string } | null {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.hostname || !projectId) return null;
    return { host: url.hostname, projectId };
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const allowed = getAllowedTunnelTarget();
  if (!allowed) {
    return new Response("Tunnel not configured", { status: 503 });
  }

  try {
    const envelope = await request.arrayBuffer();
    const firstLine = new TextDecoder().decode(envelope).split("\n")[0] ?? "";
    const header = JSON.parse(firstLine) as Record<string, unknown>;
    const dsn = typeof header.dsn === "string" ? new URL(header.dsn) : null;

    if (dsn?.hostname !== allowed.host) {
      return new Response("Invalid DSN", { status: 400 });
    }

    const projectId = dsn.pathname.replace("/", "");
    if (projectId !== allowed.projectId) {
      return new Response("Invalid project", { status: 400 });
    }

    const upstream = `https://${allowed.host}/api/${projectId}/envelope/`;
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("Content-Type") ?? "application/x-sentry-envelope" },
      body: envelope,
    });

    return new Response(await response.arrayBuffer(), { status: response.status });
  } catch {
    return new Response("Tunnel error", { status: 500 });
  }
};
