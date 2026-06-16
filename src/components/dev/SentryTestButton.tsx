import * as Sentry from "@sentry/astro";

function setStatus(message: string, isError = false) {
  const el = document.getElementById("sentry-test-status");
  if (!el) return;
  el.textContent = message;
  el.className = `text-center text-sm ${isError ? "text-red-300" : "text-green-200"}`;
}

export default function SentryTestButton() {
  async function handleClick() {
    setStatus("Sending…");

    const client = Sentry.getClient();
    let clientEventId: string | undefined;

    if (client) {
      clientEventId = Sentry.captureException(new Error("This is a test error (client)"));
      await Sentry.flush(2000);
    }

    let serverEventId: string | undefined;
    try {
      const response = await fetch("/api/debug/sentry-test", { method: "POST" });
      if (response.ok) {
        const body = (await response.json()) as { eventId?: string };
        serverEventId = body.eventId;
      }
    } catch {
      // Server test is best-effort; client result may still be useful.
    }

    if (!client && !serverEventId) {
      setStatus(
        "Sentry client is not initialized. Set SENTRY_DSN and SENTRY_DEBUG=1 in .env, restart dev, and retry.",
        true,
      );
      return;
    }

    const parts = [
      client ? `client: ${clientEventId ?? "sent"}` : "client: skipped (not initialized)",
      serverEventId ? `server: ${serverEventId}` : "server: failed",
    ];

    setStatus(`Sent to Sentry — ${parts.join(", ")}. Check Issues in 1–2 minutes.`);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium hover:bg-purple-500"
      >
        Send test errors to Sentry
      </button>
      <p id="sentry-test-status" className="text-center text-sm" role="status" />
    </div>
  );
}
