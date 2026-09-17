import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { AIProvider, ProviderChatResult, ProviderStreamChunk, SearchSource } from "../ai/provider.js";
import { classifyIntent } from "./intent-classifier.js";
import { buildOrchestratorContext } from "./context-builder.js";
import { planTask } from "./task-planner.js";
import { ProviderRegistry } from "./model-router.js";
import { verifyTaskResponse } from "./verification-layer.js";
import { OrchestratorLogger } from "./observability.js";
import type {
  OrchestratorExecuteInput,
  OrchestratorStreamEvent,
  OrchestratorTask,
  TaskError,
} from "./types.js";

export class OrchestratorExecutionError extends Error {
  code: string;
  stage: string;
  task: OrchestratorTask;

  constructor(message: string, code: string, stage: string, task: OrchestratorTask) {
    super(message);
    this.name = "OrchestratorExecutionError";
    this.code = code;
    this.stage = stage;
    this.task = task;
  }
}

import type { MemoryService } from "../memory/memory.service.js";
import type { DocumentService } from "../rag/document.service.js";

export interface OrchestratorOptions {
  registry?: ProviderRegistry;
  defaultProvider?: AIProvider;
  defaultModel?: string;
  logger?: FastifyBaseLogger;
  memoryService?: MemoryService;
  documentService?: DocumentService;
}

export class AshviOrchestrator {
  public registry: ProviderRegistry;
  public memoryService?: MemoryService;
  public documentService?: DocumentService;
  private logger: OrchestratorLogger;

  constructor(options: OrchestratorOptions = {}) {
    this.registry = options.registry ?? new ProviderRegistry();
    this.logger = new OrchestratorLogger(options.logger);
    this.memoryService = options.memoryService;
    this.documentService = options.documentService;

    if (options.defaultProvider) {
      this.registry.register(
        {
          id: "default",
          name: "Default Local Provider",
          provider: options.defaultProvider,
          defaultModel: options.defaultModel ?? "qwen2.5:3b",
          supportsStreaming: typeof options.defaultProvider.chatStream === "function",
        },
        true
      );
    }
  }

  createTask(input: OrchestratorExecuteInput): OrchestratorTask {
    const requestId = input.requestId ?? randomUUID();
    const receivedAt = new Date().toISOString();

    // 1. Intent Analysis
    const classification = classifyIntent(input.prompt, input.documentContext);
    const classifiedAt = new Date().toISOString();

    // 2. Context Assembly: Ensure user prompt is included in conversation messages
    const inputMessages = input.messages ? [...input.messages] : [];
    const lastMsg = inputMessages.at(-1);
    if (!lastMsg || lastMsg.role.toLowerCase() !== "user" || lastMsg.content !== input.prompt) {
      inputMessages.push({ role: "user", content: input.prompt });
    }

    const contextTurns = buildOrchestratorContext(
      inputMessages,
      input.documentContext,
      input.memoryContext,
      classification.intent,
      { language: input.language }
    );

    // 3. Task Planning
    const plan = planTask(input.prompt, classification.intent, classification.complexity);
    const plannedAt = new Date().toISOString();

    // 4. Model/Provider Routing
    const route = this.registry.route(
      classification.intent,
      input.providerId,
      input.modelOverride,
      { enableSearch: input.enableSearch, isPrivateOnly: input.isPrivateOnly }
    );
    const routedAt = new Date().toISOString();

    const task: OrchestratorTask = {
      requestId,
      userId: input.userId,
      conversationId: input.conversationId,
      prompt: input.prompt,
      intent: classification.intent,
      classification,
      context: {
        recentMessages: contextTurns,
        documentEvidence: input.documentContext,
        memoryFacts: input.memoryContext,
        tokenEstimate: Math.round(contextTurns.reduce((s, t) => s + t.content.length, 0) / 4),
      },
      plan,
      selectedProvider: route.providerId,
      model: route.model,
      executionState: "pending",
      verification: {
        state: "unverified",
        confidence: "medium",
        reasons: [],
      },
      timestamps: {
        receivedAt,
        classifiedAt,
        plannedAt,
        routedAt,
      },
    };

    return task;
  }

  async execute(input: OrchestratorExecuteInput): Promise<OrchestratorTask> {
    // 1. Memory retrieval before generation
    let memoryContext = input.memoryContext ?? "";
    if (this.memoryService && !memoryContext && input.prompt) {
      try {
        const memResult = await this.memoryService.retrieveContext(input.prompt, input.userId);
        memoryContext = memResult.formattedContext;
      } catch (err) {
        this.logger.logError(input.requestId ?? "unknown", "memory_retrieval", err);
      }
    }

    // 2. Document retrieval before generation (only when required)
    let documentContext = input.documentContext ?? "";
    if (this.documentService && !documentContext && input.prompt && input.userId) {
      const initialIntent = classifyIntent(input.prompt, "").intent;
      const requiresDocs =
        initialIntent === "document_analysis" ||
        initialIntent === "data_analysis" ||
        (input.documentIds && input.documentIds.length > 0) ||
        /\b(?:document|file|report|pdf|docx|spreadsheet|notes|attachment|data|section|page)\b/i.test(input.prompt);

      if (requiresDocs) {
        try {
          const docResult = await this.documentService.retrieveContext(input.prompt, input.userId, {
            documentIds: input.documentIds,
          });
          documentContext = docResult.formattedEvidence;
        } catch (err) {
          this.logger.logError(input.requestId ?? "unknown", "document_retrieval", err);
        }
      }
    }

    const task = this.createTask({ ...input, memoryContext, documentContext });
    this.logger.logRequestReceived(task);
    this.logger.logIntentClassified(task);
    this.logger.logTaskPlanned(task);

    const enableSearch = Boolean(input.enableSearch || task.intent === "web_research");
    let route = this.registry.route(task.intent, input.providerId, input.modelOverride, {
      enableSearch,
      isPrivateOnly: input.isPrivateOnly,
    });
    this.logger.logProviderRouted(task, route.reason);

    task.executionState = "executing";
    this.logger.logExecutionStarted(task.requestId);
    const startTime = Date.now();

    try {
      let content = "";
      if (task.intent === "image_generation" && typeof route.provider.generateImage === "function") {
        const imgResult = await route.provider.generateImage({ prompt: input.prompt });
        task.images = imgResult.images;
        content = `I have generated an image for you: "${input.prompt}".`;
      } else {
        let chatOutput: string | ProviderChatResult;
        try {
          chatOutput = await route.provider.chat(task.context.recentMessages, { enableSearch });
        } catch (initialErr) {
          // Failover to secondary provider if available and privacy-safe
          const fallback = this.registry.getFallback(route.providerId, input.isPrivateOnly);
          if (fallback) {
            this.logger.logProviderRouted(
              task,
              `Primary provider "${route.providerId}" failed. Gracefully falling over to "${fallback.id}".`
            );
            route = {
              providerId: fallback.id,
              model: fallback.defaultModel,
              provider: fallback.provider,
              reason: "Failover after primary provider failure",
            };
            task.selectedProvider = fallback.id;
            chatOutput = await route.provider.chat(task.context.recentMessages, { enableSearch });
          } else {
            throw initialErr;
          }
        }

        if (typeof chatOutput === "object" && chatOutput !== null) {
          content = chatOutput.content;
          if (chatOutput.sources && chatOutput.sources.length > 0) {
            task.sources = chatOutput.sources;
            task.searchUsed = true;
          }
        } else {
          content = String(chatOutput ?? "");
        }
      }

      if (!content || !content.trim()) {
        throw new Error("AI provider returned an empty response.");
      }

      const durationMs = Date.now() - startTime;
      task.timestamps.executedAt = new Date().toISOString();
      task.result = { content };
      this.logger.logExecutionCompleted(task.requestId, durationMs);

      // Verification Hook
      task.executionState = "verifying";
      task.verification = verifyTaskResponse(content, task.context.documentEvidence || input.documentContext);
      task.timestamps.verifiedAt = new Date().toISOString();
      this.logger.logVerificationCompleted(task);

      task.executionState = "completed";
      task.timestamps.completedAt = new Date().toISOString();

      // Mark plan steps as completed
      for (const step of task.plan.steps) {
        step.status = "completed";
      }

      // 2. Memory evaluation & storage after response
      if (this.memoryService && input.prompt) {
        try {
          await this.memoryService.evaluateAndStore(
            input.prompt,
            input.conversationId,
            undefined,
            input.userId
          );
        } catch (err) {
          this.logger.logError(task.requestId, "memory_evaluation", err);
        }
      }

      return task;
    } catch (error) {
      task.executionState = "failed";
      const taskError: TaskError = {
        code: "PROVIDER_FAILURE",
        message: error instanceof Error ? error.message : "Provider failure",
        stage: "executing",
        timestamp: new Date().toISOString(),
      };
      task.errors = [taskError];
      this.logger.logError(task.requestId, "executing", error);

      for (const step of task.plan.steps) {
        if (step.status === "pending" || step.status === "in_progress") {
          step.status = "failed";
        }
      }

      throw new OrchestratorExecutionError(
        taskError.message,
        taskError.code,
        taskError.stage,
        task
      );
    }
  }

  async *executeStream(
    input: OrchestratorExecuteInput
  ): AsyncIterable<OrchestratorStreamEvent> {
    // 1. Memory retrieval before generation
    let memoryContext = input.memoryContext ?? "";
    if (this.memoryService && !memoryContext && input.prompt) {
      try {
        const memResult = await this.memoryService.retrieveContext(input.prompt, input.userId);
        memoryContext = memResult.formattedContext;
      } catch (err) {
        this.logger.logError(input.requestId ?? "unknown", "memory_retrieval", err);
      }
    }

    // 2. Document retrieval before generation (only when required)
    let documentContext = input.documentContext ?? "";
    if (this.documentService && !documentContext && input.prompt && input.userId) {
      const initialIntent = classifyIntent(input.prompt, "").intent;
      const requiresDocs =
        initialIntent === "document_analysis" ||
        initialIntent === "data_analysis" ||
        initialIntent === "notebook_query" ||
        (input.documentIds && input.documentIds.length > 0) ||
        /\b(?:document|file|report|pdf|docx|spreadsheet|notes|attachment|data|section|page)\b/i.test(input.prompt);

      if (requiresDocs) {
        try {
          const docResult = await this.documentService.retrieveContext(input.prompt, input.userId, {
            documentIds: input.documentIds,
          });
          documentContext = docResult.formattedEvidence;
        } catch (err) {
          this.logger.logError(input.requestId ?? "unknown", "document_retrieval", err);
        }
      }
    }

    const task = this.createTask({ ...input, memoryContext, documentContext });
    this.logger.logRequestReceived(task);
    this.logger.logIntentClassified(task);
    this.logger.logTaskPlanned(task);

    yield {
      type: "stage",
      stage: "intent_classified",
      details: { intent: task.intent, confidence: task.classification.confidence },
    };

    const enableSearch = Boolean(input.enableSearch || task.intent === "web_research");
    let route = this.registry.route(task.intent, input.providerId, input.modelOverride, {
      enableSearch,
      isPrivateOnly: input.isPrivateOnly,
    });
    this.logger.logProviderRouted(task, route.reason);

    task.executionState = "executing";
    this.logger.logExecutionStarted(task.requestId);
    const startTime = Date.now();

    let fullContent = "";

    try {
      if (task.intent === "image_generation" && typeof route.provider.generateImage === "function") {
        yield { type: "chunk", content: "Generating your image with Nano Banana..." };
        const imgResult = await route.provider.generateImage({ prompt: input.prompt });
        task.images = imgResult.images;
        for (const img of imgResult.images) {
          yield { type: "image", image: img };
        }
        fullContent = `I have generated an image for you: "${input.prompt}".`;
      } else {
        let streamIter: AsyncIterable<string | ProviderStreamChunk> | null = null;
        try {
          if (route.provider.chatStream) {
            streamIter = route.provider.chatStream(task.context.recentMessages, { enableSearch });
          }
        } catch (streamInitErr) {
          const fallback = this.registry.getFallback(route.providerId, input.isPrivateOnly);
          if (fallback && fallback.provider.chatStream) {
            this.logger.logProviderRouted(
              task,
              `Primary stream failed. Gracefully falling over to "${fallback.id}".`
            );
            route = {
              providerId: fallback.id,
              model: fallback.defaultModel,
              provider: fallback.provider,
              reason: "Failover after primary stream initialization failure",
            };
            task.selectedProvider = fallback.id;
            streamIter = fallback.provider.chatStream(task.context.recentMessages, { enableSearch });
          } else {
            throw streamInitErr;
          }
        }

        if (streamIter) {
          for await (const rawChunk of streamIter) {
            let chunkText = "";
            let chunkSources: SearchSource[] | undefined;
            if (typeof rawChunk === "object" && rawChunk !== null) {
              chunkText = rawChunk.content || "";
              chunkSources = rawChunk.sources;
            } else {
              chunkText = String(rawChunk ?? "");
            }

            if (chunkSources && chunkSources.length > 0) {
              task.sources = chunkSources;
              task.searchUsed = true;
              yield { type: "sources", sources: chunkSources };
            }

            if (chunkText) {
              fullContent += chunkText;
              yield { type: "chunk", content: chunkText };
            }
          }
        } else {
          // Fallback to standard chat if stream is unsupported
          let chatOutput: string | ProviderChatResult;
          try {
            chatOutput = await route.provider.chat(task.context.recentMessages, { enableSearch });
          } catch (chatErr) {
            const fallback = this.registry.getFallback(route.providerId, input.isPrivateOnly);
            if (fallback) {
              this.logger.logProviderRouted(
                task,
                `Primary provider failed. Gracefully falling over to "${fallback.id}".`
              );
              route = {
                providerId: fallback.id,
                model: fallback.defaultModel,
                provider: fallback.provider,
                reason: "Failover after primary chat failure",
              };
              task.selectedProvider = fallback.id;
              chatOutput = await route.provider.chat(task.context.recentMessages, { enableSearch });
            } else {
              throw chatErr;
            }
          }

          if (typeof chatOutput === "object" && chatOutput !== null) {
            fullContent = chatOutput.content;
            if (chatOutput.sources && chatOutput.sources.length > 0) {
              task.sources = chatOutput.sources;
              task.searchUsed = true;
              yield { type: "sources", sources: chatOutput.sources };
            }
          } else {
            fullContent = String(chatOutput ?? "");
          }
          yield { type: "chunk", content: fullContent };
        }
      }

      if (!fullContent.trim()) {
        throw new Error("AI provider returned an empty response.");
      }

      const durationMs = Date.now() - startTime;
      task.timestamps.executedAt = new Date().toISOString();
      task.result = { content: fullContent };
      this.logger.logExecutionCompleted(task.requestId, durationMs);

      // Verification Hook
      task.executionState = "verifying";
      task.verification = verifyTaskResponse(fullContent, task.context.documentEvidence || input.documentContext);
      task.timestamps.verifiedAt = new Date().toISOString();
      this.logger.logVerificationCompleted(task);

      task.executionState = "completed";
      task.timestamps.completedAt = new Date().toISOString();

      for (const step of task.plan.steps) {
        step.status = "completed";
      }

      // 2. Memory evaluation & storage after stream response
      if (this.memoryService && input.prompt) {
        try {
          await this.memoryService.evaluateAndStore(
            input.prompt,
            input.conversationId,
            undefined,
            input.userId
          );
        } catch (err) {
          this.logger.logError(task.requestId, "memory_evaluation", err);
        }
      }

      yield {
        type: "done",
        task,
      };
    } catch (error) {
      task.executionState = "failed";
      const taskError: TaskError = {
        code: "PROVIDER_FAILURE",
        message: error instanceof Error ? error.message : "Provider failure",
        stage: "executing",
        timestamp: new Date().toISOString(),
      };
      task.errors = [taskError];
      this.logger.logError(task.requestId, "executing", error);

      for (const step of task.plan.steps) {
        if (step.status === "pending" || step.status === "in_progress") {
          step.status = "failed";
        }
      }

      yield {
        type: "error",
        error: "Ashvi could not reach the local AI provider.",
        code: "AI_UNAVAILABLE",
      };
    }
  }
}
