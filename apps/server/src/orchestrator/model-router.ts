import type { AIProvider } from "../ai/provider.js";
import type { TaskIntent } from "./types.js";

export interface RegisteredProvider {
  id: string;
  name: string;
  provider: AIProvider;
  defaultModel: string;
  supportsStreaming: boolean;
  priority?: number;
}

export interface RouteDecision {
  providerId: string;
  model: string;
  provider: AIProvider;
  reason: string;
}

export class ProviderRegistry {
  private providers = new Map<string, RegisteredProvider>();
  private defaultProviderId: string | null = null;

  register(registered: RegisteredProvider, isDefault = false): void {
    this.providers.set(registered.id, registered);
    if (isDefault || !this.defaultProviderId) {
      this.defaultProviderId = registered.id;
    }
  }

  get(id: string): RegisteredProvider | undefined {
    return this.providers.get(id);
  }

  list(): RegisteredProvider[] {
    return Array.from(this.providers.values());
  }

  route(
    intent: TaskIntent,
    requestedProviderId?: string,
    modelOverride?: string,
    options: { enableSearch?: boolean; isPrivateOnly?: boolean } = {}
  ): RouteDecision {
    // 1. Explicitly requested provider
    if (requestedProviderId && this.providers.has(requestedProviderId)) {
      const reg = this.providers.get(requestedProviderId)!;
      return {
        providerId: reg.id,
        model: modelOverride || reg.defaultModel,
        provider: reg.provider,
        reason: `Explicitly requested provider "${requestedProviderId}".`,
      };
    }

    // 2. Image Generation Intent -> Nano Banana / Gemini image generation
    if (intent === "image_generation") {
      const gemini = this.providers.get("gemini");
      if (gemini) {
        return {
          providerId: gemini.id,
          model: modelOverride || gemini.defaultModel,
          provider: gemini.provider,
          reason: "Image generation routed to Gemini Nano Banana provider.",
        };
      }
    }

    // 3. Web Research Intent or explicitly enabled Search -> Gemini with Search Grounding
    if (intent === "web_research" || options.enableSearch) {
      const gemini = this.providers.get("gemini");
      if (gemini) {
        return {
          providerId: gemini.id,
          model: modelOverride || gemini.defaultModel,
          provider: gemini.provider,
          reason: "Web research routed to Gemini with Google Search Grounding.",
        };
      }
    }

    // 4. Local private preferences: general conversation, coding, creative writing -> Local Qwen preferred
    if (
      intent === "general_conversation" ||
      intent === "coding" ||
      intent === "creative_writing" ||
      intent === "system_task"
    ) {
      const qwen = this.providers.get("qwen") || this.providers.get("default");
      if (qwen) {
        return {
          providerId: qwen.id,
          model: modelOverride || qwen.defaultModel,
          provider: qwen.provider,
          reason: "Local Qwen preferred for private conversation, coding, and system operations.",
        };
      }
    }

    // 5. Default provider if set
    if (this.defaultProviderId && this.providers.has(this.defaultProviderId)) {
      const reg = this.providers.get(this.defaultProviderId)!;
      return {
        providerId: reg.id,
        model: modelOverride || reg.defaultModel,
        provider: reg.provider,
        reason: `Default active provider for intent "${intent}".`,
      };
    }

    // 6. Fallback: take the first registered provider
    const first = Array.from(this.providers.values())[0];
    if (first) {
      return {
        providerId: first.id,
        model: modelOverride || first.defaultModel,
        provider: first.provider,
        reason: "Selected first available registered provider.",
      };
    }

    throw new Error("No AI providers registered in the orchestrator registry.");
  }

  /**
   * Evaluates privacy-aware failover when primary provider fails.
   * If the task is strictly private, cloud failover is disallowed.
   */
  getFallback(failedProviderId: string, isPrivateOnly = false): RegisteredProvider | null {
    if (isPrivateOnly) {
      // Never silently send private-only tasks to cloud providers
      return null;
    }

    for (const [id, reg] of this.providers.entries()) {
      if (id !== failedProviderId) {
        return reg;
      }
    }

    return null;
  }
}
