import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { Environment } from "../config/env.js";
import type { AIProvider } from "../ai/provider.js";
import { NVIDIAProvider } from "../ai/nvidia.provider.js";

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.string().optional(),
  numberOfImages: z.number().int().min(1).max(4).optional(),
});

export async function imageRoutes(app: FastifyInstance, options: { environment: Environment; provider?: AIProvider }) {
  const nvidiaProvider = options.provider ?? new NVIDIAProvider({
    apiKey: options.environment.NVIDIA_API_KEY,
    baseURL: options.environment.NVIDIA_BASE_URL,
    defaultModel: options.environment.NVIDIA_MODEL,
    temperature: options.environment.NVIDIA_TEMPERATURE,
    topP: options.environment.NVIDIA_TOP_P,
    maxTokens: options.environment.NVIDIA_MAX_TOKENS,
    enableThinking: options.environment.NVIDIA_ENABLE_THINKING,
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
      if (!nvidiaProvider.generateImage) {
        return reply.code(501).send({
          error: { code: "IMAGE_GEN_UNSUPPORTED", message: "Image generation is not supported by the current AI provider." },
        });
      }
      const result = await nvidiaProvider.generateImage({
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
      if (err instanceof Error && err.name === "AIProviderNotConfiguredError") {
        return reply.code(503).send({
          error: { code: "AI_PROVIDER_NOT_CONFIGURED", message: "No AI provider is currently configured." },
        });
      }
      if (err instanceof Error && err.message.includes("not supported")) {
        return reply.code(501).send({
          error: { code: "IMAGE_GEN_UNSUPPORTED", message: "Image generation is not supported by the current AI provider." },
        });
      }
      const message = err instanceof Error ? err.message : "Image generation failed.";
      return reply.code(500).send({
        error: { code: "IMAGE_GEN_FAILED", message },
      });
    }
  });
}
