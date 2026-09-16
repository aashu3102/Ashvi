import type { FastifyInstance } from "fastify";
import { z } from "zod";

const settingsSchema = z.object({
  preferences: z.record(z.string(), z.any()).default({}),
});

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", async (request) => {
    const { getSettings } = await import("../services/settings.service.js");
    return getSettings(app.prisma, request.userId ?? undefined);
  });

  app.patch("/api/settings", async (request, reply) => {
    const body = settingsSchema.parse(request.body);
    const { updateSettings } = await import("../services/settings.service.js");
    return reply.code(200).send(await updateSettings(app.prisma, body.preferences, request.userId ?? undefined));
  });
}
