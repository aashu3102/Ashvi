import { GoogleGenAI } from "@google/genai";
import type {
  AIProvider,
  ChatTurn,
  ImageGenerationOptions,
  ImageGenerationResult,
  ProviderChatOptions,
  ProviderChatResult,
  ProviderStreamChunk,
  SearchSource,
} from "./provider.js";

export interface GeminiProviderConfig {
  apiKey?: string;
  defaultModel?: string;
  defaultImageModel?: string;
}

function normalizeModel(model?: string): string {
  if (!model) return "gemini-3.6-flash";
  const trimmed = model.trim();
  if (trimmed === "gemini-2.5-flash" || trimmed.toLowerCase().includes("qwen") || trimmed.toLowerCase().includes("ollama")) {
    return "gemini-3.6-flash";
  }
  return trimmed;
}

export class GeminiProvider implements AIProvider {
  public readonly id = "gemini";
  public readonly name = "Gemini API";

  private ai: GoogleGenAI | null = null;
  private readonly defaultModel: string;
  private readonly defaultImageModel: string;
  private readonly apiKey?: string;

  constructor(config: GeminiProviderConfig = {}) {
    this.apiKey = config.apiKey !== undefined ? config.apiKey : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    this.defaultModel = normalizeModel(config.defaultModel || process.env.GEMINI_MODEL || process.env.ASHVI_AI_MODEL);
    this.defaultImageModel = config.defaultImageModel || "gemini-2.5-flash-image";

    if (this.apiKey && this.apiKey.trim()) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey.trim() });
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim() && this.ai);
  }

  private ensureClient(): GoogleGenAI {
    if (!this.ai || !this.apiKey || !this.apiKey.trim()) {
      throw new Error("Gemini API is not configured. Missing GEMINI_API_KEY.");
    }
    return this.ai;
  }

  /**
   * Transforms Ashvi ChatTurn messages into Gemini Content objects.
   */
  private formatMessages(messages: ChatTurn[]): {
    contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
    systemInstruction?: { parts: Array<{ text: string }> };
  } {
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    const systemParts: string[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure alternating user/model sequence and that at least one content part exists
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const systemInstruction =
      systemParts.length > 0 ? { parts: [{ text: systemParts.join("\n\n") }] } : undefined;

    return { contents, systemInstruction };
  }

  /**
   * Extracts search citations/sources from Gemini groundingMetadata.
   */
  private extractSources(groundingMetadata: unknown): SearchSource[] {
    if (!groundingMetadata || typeof groundingMetadata !== "object") return [];

    const meta = groundingMetadata as {
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };

    if (!Array.isArray(meta.groundingChunks)) return [];

    const seenUrls = new Set<string>();
    const sources: SearchSource[] = [];

    for (const chunk of meta.groundingChunks) {
      const uri = chunk.web?.uri?.trim();
      const title = chunk.web?.title?.trim() || uri || "Web Source";
      if (uri && !seenUrls.has(uri)) {
        seenUrls.add(uri);
        sources.push({
          title,
          url: uri,
        });
      }
    }

    return sources;
  }

  async chat(messages: ChatTurn[], options: ProviderChatOptions = {}): Promise<ProviderChatResult> {
    const ai = this.ensureClient();
    const model = normalizeModel(options.model || this.defaultModel);
    const { contents, systemInstruction } = this.formatMessages(messages);

    const config: Record<string, unknown> = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (options.temperature !== undefined) {
      config.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      config.maxOutputTokens = options.maxTokens;
    }
    if (options.enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });

      const candidate = response.candidates?.[0];
      const text = response.text || candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
      const sources = this.extractSources(candidate?.groundingMetadata);

      return {
        content: text,
        sources,
        searchUsed: Boolean(options.enableSearch && sources.length > 0),
        modelUsed: model,
        groundingMetadata: candidate?.groundingMetadata,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Gemini request failed: ${errorMsg}`);
    }
  }

  async *chatStream(
    messages: ChatTurn[],
    options: ProviderChatOptions = {}
  ): AsyncIterable<ProviderStreamChunk> {
    const ai = this.ensureClient();
    const model = normalizeModel(options.model || this.defaultModel);
    const { contents, systemInstruction } = this.formatMessages(messages);

    const config: Record<string, unknown> = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (options.temperature !== undefined) {
      config.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      config.maxOutputTokens = options.maxTokens;
    }
    if (options.enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config,
      });

      let accumulatedSources: SearchSource[] = [];

      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        const candidate = chunk.candidates?.[0];
        if (candidate?.groundingMetadata) {
          const sources = this.extractSources(candidate.groundingMetadata);
          if (sources.length > 0) {
            accumulatedSources = sources;
          }
        }

        if (text) {
          yield {
            content: text,
            sources: accumulatedSources.length > 0 ? accumulatedSources : undefined,
            searchUsed: Boolean(options.enableSearch && accumulatedSources.length > 0),
          };
        }
      }

      // Final completion signal if sources were retrieved
      if (accumulatedSources.length > 0) {
        yield {
          content: "",
          sources: accumulatedSources,
          searchUsed: true,
          done: true,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Gemini stream failed: ${errorMsg}`);
    }
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const ai = this.ensureClient();
    const model = options.model || this.defaultImageModel;

    try {
      // First attempt using Gemini native multimodal / Nano Banana image model (e.g. gemini-2.5-flash-image)
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
      });

      const images: Array<{ mimeType: string; base64Data: string; url?: string }> = [];

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            images.push({
              mimeType,
              base64Data: part.inlineData.data,
              url: `data:${mimeType};base64,${part.inlineData.data}`,
            });
          }
        }
      }

      // If no images returned from generateContent, attempt imagen generation fallback
      if (images.length === 0) {
        try {
          const fallbackRes = await ai.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: options.prompt,
            config: {
              numberOfImages: options.numberOfImages || 1,
            },
          });

          if (fallbackRes.generatedImages) {
            for (const genImg of fallbackRes.generatedImages) {
              if (genImg.image?.imageBytes) {
                images.push({
                  mimeType: "image/png",
                  base64Data: genImg.image.imageBytes,
                  url: `data:image/png;base64,${genImg.image.imageBytes}`,
                });
              }
            }
          }
        } catch {
          // Ignore secondary fallback failure and check image list below
        }
      }

      if (images.length === 0) {
        throw new Error("No image data returned from image generation model.");
      }

      return {
        images,
        prompt: options.prompt,
        modelUsed: model,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Image generation failed: ${errorMsg}`);
    }
  }
}
