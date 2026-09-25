import type { AIProvider, AIProviderNotConfiguredError } from "../ai/provider.js";
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

    // 2. Default provider if set
    if (this.defaultProviderId && this.providers.has(this.defaultProviderId)) {
      const reg = this.providers.get(this.defaultProviderId)!;
      return {
        providerId: reg.id,
        model: modelOverride || reg.defaultModel,
        provider: reg.provider,
        reason: `Default active provider for intent "${intent}".`,
      };
    }

    // 3. Fallback: take the first registered provider
    const first = Array.from(this.providers.values())[0];
    if (first) {
      return {
        providerId: first.id,
        model: modelOverride || first.defaultModel,
        provider: first.provider,
        reason: "Selected first available registered provider.",
      };
    }

    // 4. No provider configured - return a NoopAIProvider that throws on use
    const { NoopAIProvider } = require("../ai/provider.js");
    const noopProvider = new NoopAIProvider();
    return {
      providerId: "none",
      model: "none",
      provider: noopProvider,
      reason: "No AI provider configured. Requests will fail with AI_PROVIDER_NOT_CONFIGURED.",
    };
  }

  /**
   * Evaluates privacy-aware failover when primary provider fails.
   * If the task is strictly private, cloud failover is disallowed.
   */
  getFallback(failedProviderId: string, isPrivateOnly = false): RegisteredProvider | null {
    if (isPrivateOnly) {
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
