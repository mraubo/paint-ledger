---
change_id: sentry
title: Add and configure Sentry for Astro error monitoring
status: implemented
created: 2026-06-16
updated: 2026-06-16
archived_at: null
---

## Notes

dodaj i skonfiguruj w projekcie sentry bazując na oficjalnej dokumentacji poniżej:

<dokumenatcja>
## Install

Install the `@sentry/astro` package with the `astro` CLI:

```bash
npx astro add @sentry/astro
```

## Configure SDK

Configure the Sentry integration in your `astro.config.mjs` file:

```javascript

import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      project: "paint-ledger",
      org: "mraubo",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});

```

Create a `sentry.client.config.js` file in the root of your project to configure the client-side SDK:

```javascript

import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // To disable sending user data and HTTP bodies, uncomment the line below. For more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#dataCollection
  // dataCollection: { userInfo: false, httpBodies: [] },
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,
});

```

Create a `sentry.server.config.js` file in the root of your project to configure the server-side SDK:

```javascript

import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // To disable sending user data and HTTP bodies, uncomment the line below. For more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#dataCollection
  // dataCollection: { userInfo: false, httpBodies: [] },
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1.0,
});

```

Add your Sentry auth token to the `SENTRY_AUTH_TOKEN` environment variable:

```bash
SENTRY_AUTH_TOKEN=<FILL>
```

## Verify

Then throw a test error anywhere in your app, so you can test that everything is working:

```html

<!-- your-page.astro -->
---
---
<button id="error-button">Throw test error</button>
<script>
  import * as Sentry from "@sentry/astro";
  function handleClick () {
    // Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt`User ${"sentry-test"} triggered test error button`, {
      action: "test_error_button_click",
    });
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);
    throw new Error('This is a test error');
  }
  document.querySelector("#error-button").addEventListener("click", handleClick);
</script>

```

If you're new to Sentry, use the email alert to access your account and complete a product tour.

If you're an existing user and have disabled alerts, you won't receive this email.
</dokumenatcja>


oraz informacjach dodatkowych
<info-dodatkowe>
Do projektu Astro na Cloudflare potrzebujesz dwóch pakietów: @sentry/astro i @sentry/cloudflare. SDK automatycznie wykrywa adapter Cloudflare od wersji 10.40.0. W wrangler.toml trzeba włączyć nodejs_compat.


Uwaga — Astro 6 na Cloudflare: Astro 6 wymaga adaptera @astrojs/cloudflare w wersji 13+, który integruje się z Cloudflare przez custom entry point. Od @sentry/astro 10.44.0 (issue #19762) ta ścieżka jest wspierana — i to właśnie konfiguracja dla 10xCards (Astro 6.3.1, deploy na Workers). Zamiast domyślnego entry pointu adaptera wskazujesz w wrangler.toml własny plik, który owija handler Astro w Sentry:

# wrangler.toml
main = "./sentry.server.config.ts"  # zamiast "@astrojs/cloudflare/entrypoints/server"

// sentry.server.config.ts
import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    // przekaż console.warn / console.error do Sentry jako zdarzenia
    integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],
  }),
  handler,
);

Czysto frontendowe Astro (bez adaptera Cloudflare) opiera się o issue #19753 — tam przed wdrożeniem na Astro 6 sprawdź aktualny status.
</info-dodatkowe>
