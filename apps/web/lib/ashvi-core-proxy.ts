import { rewriteUpstreamCookie, resolveUpstreamBase, UpstreamConfigError } from "./upstream";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
  "host",
]);

const REQUEST_HEADER_ALLOW = new Set([
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "cookie",
  "if-match",
  "if-none-match",
  "last-event-id",
]);

function unreachableResponse(message = "The secure core is currently unreachable.") {
  return Response.json({ error: { code: "SECURE_CORE_UNREACHABLE", message } }, { status: 503 });
}

function copyRequestHeaders(request: Request, proxySecret?: string) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (REQUEST_HEADER_ALLOW.has(key.toLowerCase())) headers.set(key, value);
  });
  const incomingHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? "";
  if (incomingHost) headers.set("x-forwarded-host", incomingHost);
  headers.set("x-forwarded-proto", proto);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  if (proxySecret) headers.set("x-ashvi-proxy-key", proxySecret);
  return headers;
}

function copyResponseHeaders(upstream: Response, secureCookies: boolean) {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name) || name === "set-cookie" || name.startsWith("access-control-")) return;
    headers.set(key, value);
  });
  const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    headers.append("set-cookie", rewriteUpstreamCookie(cookie, secureCookies));
  }
  return headers;
}

export async function proxyToAshviCore(request: Request, pathname: string) {
  let upstreamBase: string;
  try {
    upstreamBase = resolveUpstreamBase();
  } catch (error) {
    const message = error instanceof UpstreamConfigError ? error.message : "The secure core is currently unreachable.";
    return unreachableResponse(message);
  }

  const incoming = new URL(request.url);
  const target = `${upstreamBase}${pathname}${incoming.search}`;
  const method = request.method.toUpperCase();
  const secureCookies = incoming.protocol === "https:";
  const headers = copyRequestHeaders(request, process.env.ASHVI_PROXY_SECRET);

  try {
    const init: RequestInit & { duplex?: "half" } = {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: request.signal,
    };
    if (method !== "GET" && method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half";
    }

    const upstream = await fetch(target, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyResponseHeaders(upstream, secureCookies),
    });
  } catch {
    return unreachableResponse();
  }
}
