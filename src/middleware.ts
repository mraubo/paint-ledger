import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// Page routes under /entries. When adding /api/entries/* handlers, extend this array or enforce auth per route.
const PROTECTED_ROUTES = ["/entries", "/api/entries"];

const AUTH_ONLY_GUEST_ROUTES = ["/auth/signin", "/auth/signup"];

const DEV_ONLY_ROUTES = ["/dev/sentry-test", "/api/dev"];

// Sentry tunnel is always public — used by browser SDK in all environments.
const PUBLIC_API_ROUTES = ["/api/sentry-tunnel"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (PUBLIC_API_ROUTES.some((route) => pathname === route)) {
    return next();
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (
    DEV_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)) &&
    (import.meta.env.PROD || process.env.SENTRY_DEBUG !== "1")
  ) {
    return new Response("Not Found", { status: 404 });
  }

  if (context.locals.user && AUTH_ONLY_GUEST_ROUTES.some((route) => pathname.startsWith(route))) {
    return context.redirect("/entries");
  }

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
