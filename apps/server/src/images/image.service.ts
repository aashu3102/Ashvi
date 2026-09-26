import type { GeneratedImageItem as BaseGeneratedImageItem } from "../ai/provider.js";

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
  width?: number;
  height?: number;
}

export interface GeneratedImageItem extends BaseGeneratedImageItem {
  prompt?: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  prompt: string;
  modelUsed: string;
  images: GeneratedImageItem[];
  createdAt: string;
}

export class ImageProviderUnavailableError extends Error {
  readonly code = "IMAGE_PROVIDER_UNAVAILABLE";
  constructor(message = "Image generation service is currently unavailable or disabled.") {
    super(message);
    this.name = "ImageProviderUnavailableError";
  }
}

export interface ImageProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  generate(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

function parseDimensions(aspectRatio?: string, requestedWidth?: number, requestedHeight?: number): { width: number; height: number } {
  if (requestedWidth && requestedHeight) {
    return { width: requestedWidth, height: requestedHeight };
  }

  switch (aspectRatio) {
    case "16:9":
      return { width: 1280, height: 720 };
    case "9:16":
      return { width: 720, height: 1280 };
    case "4:3":
      return { width: 1024, height: 768 };
    case "3:4":
      return { width: 768, height: 1024 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
}

/**
 * Pollinations AI image provider.
 * High-quality zero-config open image generation.
 */
export class PollinationsImageProvider implements ImageProvider {
  readonly id = "pollinations";
  readonly name = "Pollinations AI (Flux / SDXL)";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const { prompt, aspectRatio, numberOfImages = 1 } = options;
    const { width, height } = parseDimensions(aspectRatio, options.width, options.height);
    const count = Math.min(Math.max(1, numberOfImages), 4);
    const images: GeneratedImageItem[] = [];

    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 10000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

      // Attempt to fetch and encode base64 for fast local caching if possible
      let base64Data: string | undefined;
      let mimeType = "image/jpeg";

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.startsWith("image/")) {
            mimeType = contentType;
          }
          const arrayBuffer = await res.arrayBuffer();
          base64Data = Buffer.from(arrayBuffer).toString("base64");
        }
      } catch {
        // Fall back to direct CDN URL
      }

      images.push({
        url: imageUrl,
        prompt,
        width,
        height,
        mimeType: mimeType || "image/jpeg",
        base64Data: base64Data || "",
      });
    }

    return {
      prompt,
      modelUsed: "pollinations-flux",
      images,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * OpenAI DALL-E image provider (if OPENAI_API_KEY is configured).
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly id = "openai";
  readonly name = "OpenAI DALL-E";

  constructor(private readonly apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      throw new ImageProviderUnavailableError("OpenAI API key is not configured.");
    }

    const { prompt, aspectRatio, numberOfImages = 1 } = options;
    const size = aspectRatio === "16:9" ? "1792x1024" : aspectRatio === "9:16" ? "1024x1792" : "1024x1024";

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: Math.min(numberOfImages, 1), // DALL-E 3 supports 1 per request
        size,
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI image generation failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };

    const images: GeneratedImageItem[] = data.data.map((item) => ({
      url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ""),
      base64Data: item.b64_json || "",
      mimeType: "image/png",
      prompt: item.revised_prompt || prompt,
    }));

    return {
      prompt,
      modelUsed: "dall-e-3",
      images,
      createdAt: new Date().toISOString(),
    };
  }
}

export interface ImageServiceConfig {
  enabled?: boolean;
  provider?: "pollinations" | "openai" | "disabled";
  openaiApiKey?: string;
}

export class ImageService {
  private provider: ImageProvider | null = null;
  private enabled: boolean;

  constructor(config: ImageServiceConfig = {}) {
    this.enabled = config.enabled ?? true;

    if (!this.enabled || config.provider === "disabled") {
      this.provider = null;
      return;
    }

    if (config.provider === "openai" && config.openaiApiKey) {
      this.provider = new OpenAIImageProvider(config.openaiApiKey);
    } else {
      // Default to Pollinations AI for zero-config out-of-the-box real image generation
      this.provider = new PollinationsImageProvider();
    }
  }

  setProvider(provider: ImageProvider | null) {
    this.provider = provider;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.enabled || !this.provider) return false;
    return this.provider.isAvailable();
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    if (!this.enabled || !this.provider) {
      throw new ImageProviderUnavailableError(
        "Image generation is currently disabled or no image provider is configured."
      );
    }

    const available = await this.provider.isAvailable();
    if (!available) {
      throw new ImageProviderUnavailableError(
        `Configured image provider (${this.provider.name}) is currently unavailable.`
      );
    }

    return this.provider.generate(options);
  }
}
