import type { FastifyReply } from "fastify";
import type { Environment } from "../config/env.js";
import { sessionLifetimeMs } from "../services/auth.service.js";

export const sessionCookieName = "ashvi_session";

export function sessionCookieOptions(environment: Environment) {
  const isProd = environment.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: Math.floor(sessionLifetimeMs / 1000),
  };
}

export function clearSessionCookie(reply: FastifyReply, environment: Environment) {
  const isProd = environment.NODE_ENV === "production";
  return reply.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
}
