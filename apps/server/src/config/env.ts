import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  ASHVI_SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  ASHVI_FRONTEND_URL: z.url().default("http://localhost:3000"),
  ASHVI_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ASHVI_AI_MODEL: z.string().default("qwen2.5:3b"),
  OLLAMA_BASE_URL: z.url().default("http://127.0.0.1:11434"),
  ASHVI_STT_COMMAND: z.string().default("faster-whisper"),
  ASHVI_STT_ARGS: z.string().default('["--model","{model}","--language","{language}","--output","{output}","{input}"]'),
  ASHVI_STT_MODEL: z.string().default("small"),
  ASHVI_TTS_COMMAND: z.string().default("piper"),
  ASHVI_TTS_ARGS: z.string().default('["--model","{model}","--output_file","{output}"]'),
  ASHVI_TTS_MODEL: z.string().default(""),
  ASHVI_TTS_MODEL_EN: z.string().default(""),
  ASHVI_TTS_MODEL_HI: z.string().default(""),
  ASHVI_VOICE_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  ASHVI_SESSION_SECRET: z.string().min(32).optional(),
  ASHVI_USER_A_NAME: z.string().min(1).max(80).optional(),
  ASHVI_USER_A_CODE_HASH: z.string().startsWith("$argon2id$").optional(),
  ASHVI_USER_A_PASSWORD_HASH: z.string().startsWith("$argon2id$").optional(),
  ASHVI_USER_B_NAME: z.string().min(1).max(80).optional(),
  ASHVI_USER_B_CODE_HASH: z.string().startsWith("$argon2id$").optional(),
  ASHVI_USER_B_PASSWORD_HASH: z.string().startsWith("$argon2id$").optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(input);
}
