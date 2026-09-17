import fp from "fastify-plugin";
import type { Environment } from "../config/env.js";
import { resolveSession } from "../services/auth.service.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
  }
}

export const authPlugin = fp(async (app, options: { environment: Environment }) => {
  app.decorateRequest("userId", null);
  app.addHook("preHandler", async (request, reply) => {
    const isPublic = request.url === "/health" || request.url.startsWith("/api/auth/login") || request.url.startsWith("/api/auth/logout");
    if (isPublic) return;

    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const token = bearerToken || request.cookies.ashvi_session;
    if (!token) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    const session = await resolveSession(app.prisma, token, options.environment.ASHVI_SESSION_SECRET);
    if (!session) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    request.userId = session.user.id;
  });
}, { name: "ashvi-auth" });
