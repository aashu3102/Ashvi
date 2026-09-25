import type { FastifyReply, FastifyRequest } from "fastify";
import type { Environment } from "../config/env.js";

export async function getHealth(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(200).send({
    status: "ok",
    service: "ashvi-server",
    database: _request.server.hasDecorator("prisma") ? "ready" : "not-configured",
    timestamp: new Date().toISOString(),
  });
}

export async function getProviderHealth(
  request: FastifyRequest,
  reply: FastifyReply,
  _environment: Environment
) {
  let dbHealthy = false;
  if (request.server.hasDecorator("prisma") && request.server.prisma) {
    try {
      await request.server.prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }
  }

  return reply.code(200).send({
    status: "ok",
    service: "ashvi-server",
    database: dbHealthy ? "ready" : "unhealthy",
    providers: {
      ai: {
        configured: false,
        available: false,
        message: "No AI provider configured",
      },
    },
    timestamp: new Date().toISOString(),
  });
}
