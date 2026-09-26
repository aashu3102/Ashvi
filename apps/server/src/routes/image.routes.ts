import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { Environment } from "../config/env.js";
import type { AIProvider } from "../ai/provider.js";
import { ImageService, ImageProviderUnavailableError } from "../images/image.service.js";

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.string().optional(),
  numberOfImages: z.number().int().min(1).max(4).optional(),
});

export interface ImageRoutesOptions {
  environment: Environment;
  provider?: AIProvider;
  imageService?: ImageService;
}

export async function imageRoutes(app: FastifyInstance, options: ImageRoutesOptions) {
  const imageService =
    options.imageService ??
    new ImageService({
      enabled: options.environment.ASHVI_IMAGE_PROVIDER !== "disabled",
      provider:
        options.environment.ASHVI_IMAGE_PROVIDER === "openai"
          ? "openai"
          : options.environment.ASHVI_IMAGE_PROVIDER === "disabled"
          ? "disabled"
          : "pollinations",
      openaiApiKey: options.environment.OPENAI_API_KEY,
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

    try {
      const isAvailable = await imageService.isAvailable();
      if (!isAvailable) {
        return reply.code(503).send({
          error: {
            code: "IMAGE_PROVIDER_UNAVAILABLE",
            message: "Image generation service is currently unavailable or disabled.",
          },
        });
      }

      const result = await imageService.generateImage({
        prompt: parseResult.data.prompt,
        aspectRatio: parseResult.data.aspectRatio,
        numberOfImages: parseResult.data.numberOfImages,
      });

      return reply.code(200).send({
        prompt: result.prompt,
        model: result.modelUsed,
        images: result.images,
        createdAt: result.createdAt,
      });
    } catch (err: unknown) {
      request.log.error({ err }, "Image generation failed");

      if (err instanceof ImageProviderUnavailableError) {
        return reply.code(503).send({
          error: { code: err.code, message: err.message },
        });
      }

      if (err instanceof Error && err.name === "AIProviderNotConfiguredError") {
        return reply.code(503).send({
          error: { code: "AI_PROVIDER_NOT_CONFIGURED", message: "No AI provider is currently configured." },
        });
      }

      if (err instanceof Error && err.message.includes("not supported")) {
        return reply.code(501).send({
          error: { code: "IMAGE_GEN_UNSUPPORTED", message: "Image generation is not supported." },
        });
      }

      const message = err instanceof Error ? err.message : "Image generation failed.";
      return reply.code(500).send({
        error: { code: "IMAGE_GEN_FAILED", message },
      });
    }
  });
}
