const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export class UpstreamConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamConfigError";
  }
}

export function isLoopbackHostname(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
}

export function resolveUpstreamBase(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const raw = (env.ASHVI_API_URL || env.NEXT_PUBLIC_ASHVI_API_URL || env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  const onVercel = env.VERCEL === "1";

  if (onVercel) {
    if (!raw) {
      throw new UpstreamConfigError("ASHVI_API_URL or NEXT_PUBLIC_ASHVI_API_URL must be configured.");
    }
    let hostname = "";
    try {
      hostname = new URL(raw).hostname;
    } catch {
      throw new UpstreamConfigError("API URL is not a valid URL.");
    }
    if (isLoopbackHostname(hostname)) {
      throw new UpstreamConfigError("API URL cannot point at localhost in a Vercel deployment.");
    }
    return raw;
  }

  if (!raw) return "http://127.0.0.1:4000";
  return raw;
}

export function rewriteUpstreamCookie(setCookie: string, secure: boolean) {
  const parts = setCookie.split(";").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return setCookie;

  const nameValue = parts[0];
  const attributes = new Map<string, string | true>();
  for (const part of parts.slice(1)) {
    const separator = part.indexOf("=");
    const name = (separator === -1 ? part : part.slice(0, separator)).trim().toLowerCase();
    const value = separator === -1 ? true : part.slice(separator + 1).trim();
    if (!name || name === "domain") continue;
    attributes.set(name, value);
  }

  attributes.set("path", "/");
  attributes.set("samesite", "Lax");
  attributes.set("httponly", true);
  if (secure) attributes.set("secure", true);
  else attributes.delete("secure");

  const nextParts = [nameValue];
  for (const [name, value] of attributes) {
    nextParts.push(value === true ? name : `${name}=${value}`);
  }
  return nextParts.join("; ");
}
