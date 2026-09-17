import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Environment } from "../config/env.js";
import { authenticate, revokeSession } from "../services/auth.service.js";
import { clearSessionCookie, sessionCookieName, sessionCookieOptions } from "../auth/session-cookie.js";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  code: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function authRoutes(app: FastifyInstance, options: { environment: Environment }) {
  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    try {
      const result = await authenticate(app.prisma, options.environment, body.username, body.code, body.password, request.ip);
      return reply.setCookie(sessionCookieName, result.token, sessionCookieOptions(options.environment)).send({ user: result.user, token: result.token });
    } catch {
      return reply.code(401).send({ error: { code: "ACCESS_DENIED", message: "Access could not be verified." } });
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const token = bearerToken || request.cookies[sessionCookieName];
    if (token) await revokeSession(app.prisma, token, options.environment.ASHVI_SESSION_SECRET);
    return clearSessionCookie(reply, options.environment).code(204).send();
  });

  app.get("/api/auth/session", async (request, reply) => {
    return request.userId ? reply.send({ authenticated: true }) : reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
  });
}
