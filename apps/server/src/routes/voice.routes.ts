import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Environment } from "../config/env.js";
import { FasterWhisperProvider } from "../voice/faster-whisper.provider.js";
import { PiperProvider } from "../voice/piper.provider.js";
import { VoiceProviderError } from "../voice/provider.js";

const languageSchema = z.enum(["en", "hi"]).default("en");
const synthesisSchema = z.object({ text: z.string().trim().min(1).max(12000), language: languageSchema });

export async function voiceRoutes(app: FastifyInstance, options: { environment: Environment }) {
  const stt = new FasterWhisperProvider(options.environment);
  const tts = new PiperProvider(options.environment);

  app.post<{ Querystring: { language?: string } }>("/api/voice/transcribe", async (request, reply) => {
    const language = languageSchema.safeParse(request.query.language ?? "en");
    if (!language.success) return reply.code(400).send({ error: { code: "INVALID_LANGUAGE", message: "Choose English or Hindi." } });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: { code: "AUDIO_REQUIRED", message: "Record audio before transcribing." } });

    try {
      const transcript = await stt.transcribe(await file.toBuffer(), file.filename || "recording.webm", language.data);
      return { transcript, language: language.data };
    } catch (error) {
      if (error instanceof VoiceProviderError) return reply.code(503).send({ error: { code: error.code, message: error.message } });
      request.log.error({ err: error }, "Speech recognition failed");
      return reply.code(503).send({ error: { code: "STT_UNAVAILABLE", message: "Local speech recognition is unavailable." } });
    }
  });

  app.post("/api/voice/synthesize", async (request, reply) => {
    const body = synthesisSchema.parse(request.body);
    try {
      const result = await tts.synthesize(body.text, body.language);
      return reply.type(result.contentType).header("cache-control", "no-store").send(result.audio);
    } catch (error) {
      if (error instanceof VoiceProviderError) return reply.code(503).send({ error: { code: error.code, message: error.message } });
      request.log.error({ err: error }, "Speech synthesis failed");
      return reply.code(503).send({ error: { code: "TTS_UNAVAILABLE", message: "Local voice output is unavailable." } });
    }
  });
}
