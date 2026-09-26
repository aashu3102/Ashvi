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
  ASHVI_STT_COMMAND: z.string().default("faster-whisper"),
  ASHVI_STT_ARGS: z.string().default('["--model","{model}","--language","{language}","--output","{output}","{input}"]'),
  ASHVI_STT_MODEL: z.string().default("small"),
  ASHVI_TTS_COMMAND: z.string().default("piper"),
  ASHVI_TTS_ARGS: z.string().default('["--model","{model}","--output_file","{output}"]'),
  ASHVI_TTS_MODEL: z.string().default(""),
  ASHVI_TTS_MODEL_EN: z.string().default(""),
  ASHVI_TTS_MODEL_HI: z.string().default(""),
  ASHVI_VOICE_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  ASHVI_SESSION_SECRET: z.string().min(32).default("RfrKHEq1L4hbyTcK7LcL7fzTPgjNIZPcfkRRm2O2or8"),
  ASHVI_USER_A_NAME: z.string().min(1).max(80).default("Aashu Singh"),
  ASHVI_USER_A_CODE_HASH: z.string().startsWith("$argon2id$").default("$argon2id$v=19$m=65536,t=3,p=4$6kIQONoOzrJvNwCjuPC3KQ$hIOLr1XVuFeGDHeUFGBe77INKBkVI2XzcU3xljTjiCQ"),
  ASHVI_USER_A_PASSWORD_HASH: z.string().startsWith("$argon2id$").default("$argon2id$v=19$m=65536,t=3,p=4$GaX6iqIYoFyXY5wTKszjGQ$eon8hP2eBOgVqI1YfytMqCfD6GUYS2BSi0Rb4JQi9Mo"),
  ASHVI_USER_B_NAME: z.string().min(1).max(80).default("Shambhavi Singh"),
  ASHVI_USER_B_CODE_HASH: z.string().startsWith("$argon2id$").default("$argon2id$v=19$m=65536,t=3,p=4$vhwRP4vVdcIYbdubYnuZjA$/15P6YR9YJwqff6Uui1JVivWc7mJR3vCRProw3fyfhg"),
  ASHVI_USER_B_PASSWORD_HASH: z.string().startsWith("$argon2id$").default("$argon2id$v=19$m=65536,t=3,p=4$RFKJLwJHGPQs70IYr6g7Wg$VcGUSRiyFjPbfmRxegRF7z4umEpdYsa8PdkLBLcIp3A"),
  ASHVI_MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).max(500).default(50),
  ASHVI_MAX_FILES_PER_BATCH: z.coerce.number().int().min(1).max(100).default(30),
  ASHVI_MAX_DOCUMENT_PAGES: z.coerce.number().int().min(1).max(5000).default(800),
  ASHVI_CHUNK_SIZE: z.coerce.number().int().min(50).max(2000).default(350),
  ASHVI_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(500).default(50),
  ASHVI_EMBEDDING_PROVIDER: z.enum(["local"]).default("local"),
  ASHVI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(16).max(4096).default(384),
  ASHVI_RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(4),
  ASHVI_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.15),

  // NVIDIA Nemotron AI Provider
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.url().default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_MODEL: z.string().default("nvidia/nemotron-3-ultra-550b-a55b"),
  NVIDIA_TEMPERATURE: z.coerce.number().min(0).max(2).default(1),
  NVIDIA_TOP_P: z.coerce.number().min(0).max(1).default(0.95),
  NVIDIA_MAX_TOKENS: z.coerce.number().int().min(1).max(16384).default(16384),
  NVIDIA_ENABLE_THINKING: z.coerce.boolean().default(true),

  // Web Search Grounding
  ASHVI_SEARCH_ENABLED: z.coerce.boolean().default(true),
  TAVILY_API_KEY: z.string().optional(),

  // Image Generation
  ASHVI_IMAGE_PROVIDER: z.enum(["pollinations", "openai", "disabled"]).default("pollinations"),
  OPENAI_API_KEY: z.string().optional(),
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
