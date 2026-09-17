import type { FastifyInstance } from "fastify";
import type { Environment } from "../config/env.js";
import { getHealth, getProviderHealth } from "../controllers/health.controller.js";

export async function healthRoutes(app: FastifyInstance, options: { environment: Environment }) {
  app.get("/health", getHealth);
  app.get("/health/providers", async (req, reply) => getProviderHealth(req, reply, options.environment));
}
