export interface Env {
  ORIGIN_URL: string;
  ASHVI_PROXY_SECRET: string;
}

function isHealth(url: URL) {
  return url.pathname === "/health";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url);
    const originBase = (env.ORIGIN_URL ?? "").replace(/\/+$/, "");
    if (!originBase) {
      return Response.json({ error: { code: "SECURE_CORE_UNREACHABLE", message: "The secure core is currently unreachable." } }, { status: 503 });
    }

    if (request.method !== "OPTIONS" && !isHealth(incoming)) {
      if (!env.ASHVI_PROXY_SECRET || request.headers.get("x-ashvi-proxy-key") !== env.ASHVI_PROXY_SECRET) {
        return Response.json({ error: { code: "FORBIDDEN", message: "Authentication required." } }, { status: 403 });
      }
    }

    const target = `${originBase}${incoming.pathname}${incoming.search}`;
    const headers = new Headers(request.headers);
    headers.set("host", new URL(originBase).host);

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    try {
      return await fetch(target, init);
    } catch {
      return Response.json({ error: { code: "SECURE_CORE_UNREACHABLE", message: "The secure core is currently unreachable." } }, { status: 503 });
    }
  },
};
