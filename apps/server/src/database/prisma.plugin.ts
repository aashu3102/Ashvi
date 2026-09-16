import type { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";
import { createPrismaClient } from "./prisma.js";
import type { Environment } from "../config/env.js";
import { initializeIdentities } from "../services/auth.service.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app, options: { environment: Environment }) => {
  const prisma = createPrismaClient();
  await prisma.$connect();
  app.decorate("prisma", prisma);
  if (options.environment.NODE_ENV !== "test") await initializeIdentities(prisma, options.environment);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
}, { name: "ashvi-prisma" });
