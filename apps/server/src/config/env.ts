import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  ASHVI_SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  ASHVI_SERVER_HOST: z.string().min(1).default("127.0.0.1"),
  ASHVI_FRONTEND_URL: z.url().default("http://localhost:3000"),
  ASHVI_ALLOWED_ORIGINS: z.string().optional(),
  ASHVI_PROXY_SECRET: z.string().min(32).optional(),
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
  ASHVI_MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).max(500).default(50),
  ASHVI_MAX_FILES_PER_BATCH: z.coerce.number().int().min(1).max(100).default(30),
  ASHVI_MAX_DOCUMENT_PAGES: z.coerce.number().int().min(1).max(5000).default(800),
  ASHVI_CHUNK_SIZE: z.coerce.number().int().min(50).max(2000).default(350),
  ASHVI_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(500).default(50),
  ASHVI_EMBEDDING_PROVIDER: z.enum(["local", "ollama"]).default("local"),
  ASHVI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(16).max(4096).default(384),
  ASHVI_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(4),
  ASHVI_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.15),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const isCloudHost = Boolean(input.PORT || input.RENDER || input.RAILWAY_STATIC_URL || input.FLY_APP_NAME);
  const normalized = {
    ...input,
    ASHVI_SERVER_PORT: input.ASHVI_SERVER_PORT || input.PORT || "4000",
    ASHVI_SERVER_HOST: input.ASHVI_SERVER_HOST || (isCloudHost ? "0.0.0.0" : "127.0.0.1"),
  };
  return environmentSchema.parse(normalized);
}
