export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ProviderChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableSearch?: boolean;
}

export interface ProviderChatResult {
  content: string;
  sources?: SearchSource[];
  searchUsed?: boolean;
  modelUsed?: string;
  groundingMetadata?: unknown;
}

export interface ProviderStreamChunk {
  content: string;
  sources?: SearchSource[];
  searchUsed?: boolean;
  done?: boolean;
}

export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface GeneratedImageItem {
  mimeType: string;
  base64Data: string;
  url?: string;
}

export interface ImageGenerationResult {
  images: GeneratedImageItem[];
  prompt: string;
  modelUsed: string;
}

export class AIProviderNotConfiguredError extends Error {
  constructor(message = "No AI provider is currently configured.") {
    super(message);
    this.name = "AIProviderNotConfiguredError";
  }
}

export interface AIProvider {
  id?: string;
  name?: string;
  isAvailable?(): Promise<boolean>;
  chat(messages: ChatTurn[], options?: ProviderChatOptions): Promise<string | ProviderChatResult>;
  chatStream?(messages: ChatTurn[], options?: ProviderChatOptions): AsyncIterable<string | ProviderStreamChunk>;
  generateImage?(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

export class NoopAIProvider implements AIProvider {
  public readonly id = "none";
  public readonly name = "No AI Provider";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async chat(): Promise<ProviderChatResult> {
    throw new AIProviderNotConfiguredError();
  }

  async *chatStream(): AsyncIterable<ProviderStreamChunk> {
    throw new AIProviderNotConfiguredError();
  }

  async generateImage(): Promise<ImageGenerationResult> {
    throw new AIProviderNotConfiguredError();
  }
}
