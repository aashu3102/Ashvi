import fp from "fastify-plugin";
import type { Environment } from "../config/env.js";

function requestPath(url: string) {
  return url.split("?")[0] ?? url;
}

export const proxyGatePlugin = fp(async (app, options: { environment: Environment }) => {
  app.addHook("onRequest", async (request, reply) => {
    const secret = options.environment.ASHVI_PROXY_SECRET;
    if (!secret) return;

    const path = requestPath(request.url);
    if (request.method === "OPTIONS" || path === "/health") return;

    const provided = request.headers["x-ashvi-proxy-key"];
    if (provided !== secret) {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Authentication required." } });
    }
  });
}, { name: "ashvi-proxy-gate" });
