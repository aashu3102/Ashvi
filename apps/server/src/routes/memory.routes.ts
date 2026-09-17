import type { FastifyInstance } from "fastify";
import { z } from "zod";

const memoryCategorySchema = z.enum([
  "PREFERENCE",
  "FACT",
  "PROJECT",
  "DECISION",
  "ROUTINE",
  "CONTEXT",
  "INSTRUCTION",
  "OTHER",
]);

const input = z.object({
  content: z.string().trim().min(1).max(10000),
  category: memoryCategorySchema.default("OTHER"),
  source: z.enum(["USER", "SYSTEM", "DOCUMENT", "EXPLICIT_MEMORY", "OTHER"]).default("EXPLICIT_MEMORY"),
  importance: z.number().int().min(1).max(5).default(3),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  scope: z.enum(["PRIVATE", "SHARED"]).default("PRIVATE"),
});

const update = input.partial().omit({ source: true });

export async function memoryRoutes(app: FastifyInstance) {
  app.get("/api/memory", async (request) =>
    app.prisma
      ? (await import("../services/memory.service.js")).listMemory(app.prisma, request.userId ?? undefined)
      : []
  );

  app.post("/api/memory", async (req, reply) => {
    const data = input.parse(req.body);
    const { createMemory } = await import("../services/memory.service.js");
    return reply.code(201).send(await createMemory(app.prisma, data, req.userId ?? undefined));
  });

  app.patch<{ Params: { id: string } }>("/api/memory/:id", async (req, reply) => {
    const data = update.parse(req.body);
    const { updateMemory } = await import("../services/memory.service.js");
    const memory = await updateMemory(app.prisma, req.params.id, data, req.userId ?? undefined);
    return memory ? reply.send(memory) : reply.code(404).send({ error: { code: "NOT_FOUND", message: "Memory not found." } });
  });

  app.delete<{ Params: { id: string } }>("/api/memory/:id", async (req, reply) => {
    const { deleteMemory } = await import("../services/memory.service.js");
    return (await deleteMemory(app.prisma, req.params.id, req.userId ?? undefined))
      ? reply.code(204).send()
      : reply.code(404).send({ error: { code: "NOT_FOUND", message: "Memory not found." } });
  });

  app.post<{ Params: { id: string } }>("/api/memory/:id/share", async (req, reply) => {
    const { shareMemory } = await import("../services/memory.service.js");
    const memory = await shareMemory(app.prisma, req.params.id, req.userId ?? undefined);
    return memory ? reply.send(memory) : reply.code(404).send({ error: { code: "NOT_FOUND", message: "Memory not found." } });
  });

  app.post<{ Params: { id: string } }>("/api/memory/:id/unshare", async (req, reply) => {
    const { unshareMemory } = await import("../services/memory.service.js");
    const memory = await unshareMemory(app.prisma, req.params.id, req.userId ?? undefined);
    return memory ? reply.send(memory) : reply.code(404).send({ error: { code: "NOT_FOUND", message: "Memory not found." } });
  });
}
