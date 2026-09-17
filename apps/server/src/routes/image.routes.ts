import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { Environment } from "../config/env.js";
import { GeminiProvider } from "../ai/gemini.provider.js";

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.string().optional(),
  numberOfImages: z.number().int().min(1).max(4).optional(),
});

export async function imageRoutes(app: FastifyInstance, options: { environment: Environment }) {
  const geminiProvider = new GeminiProvider({
    apiKey: options.environment.GEMINI_API_KEY,
    defaultImageModel: options.environment.GEMINI_IMAGE_MODEL,
  });

  app.post("/api/images/generate", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }

    const parseResult = generateImageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid image generation request.", details: parseResult.error.issues },
      });
    }

    const isAvailable = await geminiProvider.isAvailable();
    if (!isAvailable) {
      return reply.code(503).send({
        error: { code: "IMAGE_GEN_UNAVAILABLE", message: "Image generation is currently unavailable. Gemini API is not configured." },
      });
    }

    try {
      const result = await geminiProvider.generateImage({
        prompt: parseResult.data.prompt,
        aspectRatio: parseResult.data.aspectRatio,
        numberOfImages: parseResult.data.numberOfImages,
      });

      return reply.code(200).send({
        prompt: result.prompt,
        model: result.modelUsed,
        images: result.images,
        createdAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      request.log.error({ err }, "Image generation failed");
      const message = err instanceof Error ? err.message : "Image generation failed.";
      return reply.code(500).send({
        error: { code: "IMAGE_GEN_FAILED", message },
      });
    }
  });
}
