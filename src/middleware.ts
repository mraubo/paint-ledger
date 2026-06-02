import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// Page routes under /entries. When adding /api/entries/* handlers, extend this array or enforce auth per route.
const PROTECTED_ROUTES = ["/entries"];

const AUTH_ONLY_GUEST_ROUTES = ["/auth/signin", "/auth/signup"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  const { pathname } = context.url;

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
