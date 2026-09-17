import type { FastifyBaseLogger } from "fastify";
import type { OrchestratorTask } from "./types.js";

const REDACT_PATTERNS = [
  /bearer\s+[a-zA-Z0-9_\-.]+/gi,
  /api[_-]?key["':\s=]+[a-zA-Z0-9_\-.]+/gi,
  /password["':\s=]+[^\s,"']+/gi,
  /token["':\s=]+[a-zA-Z0-9_\-.]+/gi,
  /cookie["':\s=]+[^\s,"']+/gi,
];

export function sanitize(text: string): string {
  let cleaned = text;
  for (const pattern of REDACT_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED]");
  }
  return cleaned;
}

export class OrchestratorLogger {
  private logger?: FastifyBaseLogger;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = logger;
  }

  logRequestReceived(task: Pick<OrchestratorTask, "requestId" | "userId" | "conversationId" | "prompt">): void {
    const msg = `[Orchestrator] Request received: requestId=${task.requestId} conversationId=${task.conversationId} userId=${task.userId ?? "anonymous"}`;
    if (this.logger) {
      this.logger.info({
        stage: "request_received",
        requestId: task.requestId,
        conversationId: task.conversationId,
        userId: task.userId,
        promptPreview: sanitize(task.prompt.slice(0, 100)),
      }, msg);
    } else {
      console.log(msg);
    }
  }

  logIntentClassified(task: Pick<OrchestratorTask, "requestId" | "classification">): void {
    const { intent, confidence, complexity } = task.classification;
    const msg = `[Orchestrator] Intent classified: requestId=${task.requestId} intent=${intent} confidence=${confidence} complexity=${complexity}`;
    if (this.logger) {
      this.logger.info({
        stage: "intent_classified",
        requestId: task.requestId,
        intent,
        confidence,
        complexity,
      }, msg);
    } else {
      console.log(msg);
    }
  }

  logTaskPlanned(task: Pick<OrchestratorTask, "requestId" | "plan">): void {
    const msg = `[Orchestrator] Task planned: requestId=${task.requestId} type=${task.plan.type} steps=${task.plan.steps.length}`;
    if (this.logger) {
      this.logger.info({
        stage: "task_planned",
        requestId: task.requestId,
        planType: task.plan.type,
        stepCount: task.plan.steps.length,
      }, msg);
    } else {
      console.log(msg);
    }
  }

  logProviderRouted(task: Pick<OrchestratorTask, "requestId" | "selectedProvider" | "model">, reason: string): void {
    const msg = `[Orchestrator] Provider routed: requestId=${task.requestId} provider=${task.selectedProvider} model=${task.model}`;
    if (this.logger) {
      this.logger.info({
        stage: "provider_routed",
        requestId: task.requestId,
        provider: task.selectedProvider,
        model: task.model,
        reason,
      }, msg);
    } else {
      console.log(msg);
    }
  }

  logExecutionStarted(requestId: string): void {
    const msg = `[Orchestrator] Execution started: requestId=${requestId}`;
    if (this.logger) {
      this.logger.info({ stage: "execution_started", requestId }, msg);
    } else {
      console.log(msg);
    }
  }

  logExecutionCompleted(requestId: string, durationMs: number): void {
    const msg = `[Orchestrator] Execution completed: requestId=${requestId} durationMs=${durationMs}`;
    if (this.logger) {
      this.logger.info({ stage: "execution_completed", requestId, durationMs }, msg);
    } else {
      console.log(msg);
    }
  }

  logVerificationCompleted(task: Pick<OrchestratorTask, "requestId" | "verification">): void {
    const { state, confidence, reasons } = task.verification;
    const msg = `[Orchestrator] Verification completed: requestId=${task.requestId} state=${state} confidence=${confidence}`;
    if (this.logger) {
      this.logger.info({
        stage: "verification_completed",
        requestId: task.requestId,
        state,
        confidence,
        reasons,
      }, msg);
    } else {
      console.log(msg);
    }
  }

  logError(requestId: string, stage: string, error: unknown): void {
    const errMessage = error instanceof Error ? error.message : String(error);
    const msg = `[Orchestrator] Pipeline error at stage=${stage}: requestId=${requestId} error=${sanitize(errMessage)}`;
    if (this.logger) {
      this.logger.error({ stage, requestId, error: sanitize(errMessage) }, msg);
    } else {
      console.error(msg);
    }
  }
}
