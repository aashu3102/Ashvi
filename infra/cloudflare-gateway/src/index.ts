export interface Env {
  ORIGIN_URL: string;
  ASHVI_PROXY_SECRET?: string;
  ASHVI_FRONTEND_URL?: string;
  ASHVI_ALLOWED_ORIGINS?: string;
}

function isHealth(url: URL) {
  return url.pathname === "/health";
}

function getCorsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("origin") || "";
  const headers = new Headers();

  const isAllowed =
    !origin ||
    origin.endsWith(".vercel.app") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin === env.ASHVI_FRONTEND_URL ||
    (env.ASHVI_ALLOWED_ORIGINS && env.ASHVI_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).includes(origin));

  if (isAllowed && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  } else if (!origin) {
    headers.set("Access-Control-Allow-Origin", "*");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, Accept, X-Requested-With, X-Ashvi-Proxy-Key");
  headers.set("Access-Control-Expose-Headers", "Set-Cookie, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // Edge Preflight Response
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const incoming = new URL(request.url);
    const originBase = (env.ORIGIN_URL ?? "").replace(/\/+$/, "");

    if (!originBase) {
      corsHeaders.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({ error: { code: "SECURE_CORE_UNREACHABLE", message: "The secure core is currently unreachable. ORIGIN_URL is not configured." } }),
        { status: 503, headers: corsHeaders },
      );
    }

    if (!isHealth(incoming) && env.ASHVI_PROXY_SECRET) {
      const providedKey = request.headers.get("x-ashvi-proxy-key");
      if (providedKey && providedKey !== env.ASHVI_PROXY_SECRET) {
        corsHeaders.set("Content-Type", "application/json");
        return new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", message: "Authentication required." } }),
          { status: 403, headers: corsHeaders },
        );
      }
    }

    const target = `${originBase}${incoming.pathname}${incoming.search}`;
    const headers = new Headers(request.headers);
    headers.set("host", new URL(originBase).host);
    if (env.ASHVI_PROXY_SECRET) {
      headers.set("x-ashvi-proxy-key", env.ASHVI_PROXY_SECRET);
    }

    const init: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half";
    }

    try {
      const upstream = await fetch(target, init);
      const responseHeaders = new Headers(upstream.headers);
      const origin = request.headers.get("origin");
      if (origin && corsHeaders.has("Access-Control-Allow-Origin")) {
        responseHeaders.set("Access-Control-Allow-Origin", origin);
        responseHeaders.set("Access-Control-Allow-Credentials", "true");
        responseHeaders.set("Access-Control-Expose-Headers", "Set-Cookie, Authorization");
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch {
      corsHeaders.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({ error: { code: "SECURE_CORE_UNREACHABLE", message: "The secure core is currently unreachable." } }),
        { status: 503, headers: corsHeaders },
      );
    }
  },
};
