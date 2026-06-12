const DEV_SERVER_MESSAGE = "Astro dev server is not reachable. Run: npm run dev (http://localhost:4321)";
const LOCAL_APP_URL_MESSAGE =
  "APP_URL must point at local dev server (localhost or 127.0.0.1). HTTP integration tests are local-only.";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "host.docker.internal"]);

function assertLocalAppUrl(url: string): void {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(LOCAL_APP_URL_MESSAGE);
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(LOCAL_APP_URL_MESSAGE);
  }
}

export const APP_BASE_URL = process.env.APP_URL ?? "http://localhost:4321";
assertLocalAppUrl(APP_BASE_URL);
export const APP_ORIGIN = new URL(APP_BASE_URL).origin;

function resolveUrl(path: string): string {
  return path.startsWith("http") ? path : new URL(path, APP_BASE_URL).toString();
}

function connectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || error.message.includes("fetch failed");
}

function cookieHeaderFromResponse(response: Response): string {
  if (typeof response.headers.getSetCookie === "function") {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
    }
  }

  const raw = response.headers.get("set-cookie");
  if (!raw) {
    return "";
  }

  return raw
    .split(/,(?=\s*[^;,]+=[^;,]+)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

export async function requireDevServer(): Promise<void> {
  try {
    const response = await fetch(resolveUrl("/entries"), { redirect: "manual" });

    if (response.status >= 500) {
      throw new Error(`${DEV_SERVER_MESSAGE} (got HTTP ${response.status})`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(DEV_SERVER_MESSAGE)) {
      throw error;
    }

    if (connectionRefused(error)) {
      throw new Error(DEV_SERVER_MESSAGE);
    }

    throw error;
  }
}

export async function signInViaHttp(email: string, password: string): Promise<string> {
  const response = await fetch(resolveUrl("/api/auth/signin"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: APP_ORIGIN,
    },
    body: new URLSearchParams({ email, password }),
    redirect: "manual",
  });

  if (![302, 303].includes(response.status)) {
    throw new Error(`Sign-in via HTTP failed for ${email}: expected redirect, got ${response.status}`);
  }

  const location = response.headers.get("location");
  if (!location || new URL(location, APP_BASE_URL).pathname !== "/entries") {
    throw new Error(`Sign-in via HTTP failed for ${email}: unexpected Location ${location ?? "(missing)"}`);
  }

  const cookie = cookieHeaderFromResponse(response);
  if (!cookie) {
    throw new Error(`Sign-in via HTTP failed for ${email}: no Set-Cookie (status ${response.status})`);
  }

  return cookie;
}

export async function httpGet(path: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = cookie;
  }

  return fetch(resolveUrl(path), {
    method: "GET",
    headers,
    redirect: "manual",
  });
}

export async function httpPostForm(path: string, fields: Record<string, string>, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: APP_ORIGIN,
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  return fetch(resolveUrl(path), {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
}
