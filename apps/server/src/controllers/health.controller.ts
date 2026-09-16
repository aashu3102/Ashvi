import type { FastifyReply, FastifyRequest } from "fastify";

export async function getHealth(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(200).send({
    status: "ok",
    service: "ashvi-server",
    database: _request.server.hasDecorator("prisma") ? "ready" : "not-configured",
    timestamp: new Date().toISOString(),
  });
}
