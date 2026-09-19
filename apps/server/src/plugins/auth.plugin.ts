import fp from "fastify-plugin";
import type { Environment } from "../config/env.js";
import { resolveSession } from "../services/auth.service.js";
import { sessionCookieName } from "../auth/session-cookie.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
    user: { id: string; name: string } | null;
  }
}

function requestPath(url: string) {
  return url.split("?")[0] ?? url;
}

export const authPlugin = fp(async (app, options: { environment: Environment }) => {
  app.decorateRequest("userId", null);
  app.decorateRequest("user", null);
  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const path = requestPath(request.url);
    const isPublic = path === "/health" || path === "/health/providers" || path === "/api/auth/login" || path === "/api/auth/logout";
    if (isPublic) return;

    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const token = bearerToken || request.cookies[sessionCookieName];
    if (!token) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    const session = await resolveSession(app.prisma, token, options.environment.ASHVI_SESSION_SECRET);
    if (!session) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    request.userId = session.user.id;
    request.user = { id: session.user.id, name: session.user.name };
  });
}, { name: "ashvi-auth" });
