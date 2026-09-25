import OpenAI from "openai";
import type { Environment } from "../config/env.js";
import type {
  AIProvider,
  AIProviderNotConfiguredError,
  ChatTurn,
  ProviderChatOptions,
  ProviderChatResult,
  ProviderStreamChunk,
  ImageGenerationOptions,
  ImageGenerationResult,
  SearchSource,
} from "./provider.js";

export interface NVIDIAProviderConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  enableThinking?: boolean;
}

function normalizeModel(model?: string): string {
  if (!model) return "nvidia/nemotron-3-ultra-550b-a55b";
  return model.trim();
}

export class NVIDIAProvider implements AIProvider {
  public readonly id = "nvidia";
  public readonly name = "NVIDIA Nemotron";

  private client: OpenAI | null = null;
  private readonly defaultModel: string;
  private readonly temperature: number;
  private readonly topP: number;
  private readonly maxTokens: number;
  private readonly enableThinking: boolean;
  private readonly apiKey?: string;
  private readonly baseURL: string;

  constructor(config: NVIDIAProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.NVIDIA_API_KEY;
    this.baseURL = config.baseURL ?? "https://integrate.api.nvidia.com/v1";
    this.defaultModel = normalizeModel(config.defaultModel ?? process.env.NVIDIA_MODEL);
    this.temperature = config.temperature ?? 1;
    this.topP = config.topP ?? 0.95;
    this.maxTokens = config.maxTokens ?? 16384;
    this.enableThinking = config.enableThinking ?? true;

    if (this.apiKey && this.apiKey.trim()) {
      this.client = new OpenAI({
        apiKey: this.apiKey.trim(),
        baseURL: this.baseURL,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim() && this.client);
  }

  private ensureClient(): OpenAI {
    if (!this.client || !this.apiKey || !this.apiKey.trim()) {
      throw new Error("NVIDIA Nemotron API is not configured. Missing NVIDIA_API_KEY.");
    }
    return this.client;
  }

  private formatMessages(messages: ChatTurn[]): Array<{ role: "user" | "assistant" | "system"; content: string }> {
    const formatted: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
    const systemParts: string[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        formatted.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    if (formatted.length === 0) {
      formatted.push({ role: "user", content: "Hello" });
    }

    if (systemParts.length > 0) {
      formatted.unshift({
        role: "system",
        content: systemParts.join("\n\n"),
      });
    }

    return formatted;
  }

  private extractSources(_groundingMetadata: unknown): SearchSource[] {
    return [];
  }

  async chat(messages: ChatTurn[], options: ProviderChatOptions = {}): Promise<ProviderChatResult> {
    const client = this.ensureClient();
    const model = normalizeModel(options.model ?? this.defaultModel);
    const formattedMessages = this.formatMessages(messages);

    const chatOptions = {
      model,
      messages: formattedMessages,
      temperature: options.temperature ?? this.temperature,
      top_p: this.topP,
      max_tokens: options.maxTokens ?? this.maxTokens,
      stream: false,
      ...(this.enableThinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    } as const;

    try {
      const response = await client.chat.completions.create(chatOptions);

      const choice = response.choices?.[0];
      const content = choice?.message?.content ?? "";
      const reasoningContent = (choice?.message as any)?.reasoning_content ?? undefined;

      return {
        content: content,
        sources: undefined,
        searchUsed: false,
        modelUsed: model,
        groundingMetadata: reasoningContent ? { reasoningContent } : undefined,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`NVIDIA Nemotron request failed: ${errorMsg}`);
    }
  }

  async *chatStream(messages: ChatTurn[], options: ProviderChatOptions = {}): AsyncIterable<ProviderStreamChunk> {
    const client = this.ensureClient();
    const model = normalizeModel(options.model ?? this.defaultModel);
    const formattedMessages = this.formatMessages(messages);

    const chatOptions = {
      model,
      messages: formattedMessages,
      temperature: options.temperature ?? this.temperature,
      top_p: this.topP,
      max_tokens: options.maxTokens ?? this.maxTokens,
      stream: true,
      ...(this.enableThinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    } as const;

    try {
      const stream = await client.chat.completions.create(chatOptions);

      let accumulatedReasoning = "";

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        const content = choice?.delta?.content ?? "";
        const reasoningContent = (choice?.delta as any)?.reasoning_content ?? "";

        if (reasoningContent) {
          accumulatedReasoning += reasoningContent;
        }

        if (content) {
          yield {
            content: content,
            sources: undefined,
            searchUsed: false,
          };
        }
      }

      if (accumulatedReasoning) {
        yield {
          content: "",
          sources: undefined,
          searchUsed: false,
          done: true,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`NVIDIA Nemotron stream failed: ${errorMsg}`);
    }
  }

  async generateImage(_options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    throw new Error("Image generation is not supported by NVIDIA Nemotron provider.");
  }
}