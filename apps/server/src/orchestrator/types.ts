import type { ChatTurn, GeneratedImageItem, SearchSource } from "../ai/provider.js";

export type TaskIntent =
  | "general_conversation"
  | "coding"
  | "research"
  | "web_research"
  | "image_generation"
  | "notebook_query"
  | "document_analysis"
  | "creative_writing"
  | "data_analysis"
  | "system_task"
  | "unknown";

export type TaskComplexity = "simple" | "complex";

export type ClassificationResult = {
  intent: TaskIntent;
  confidence: number;
  reasons: string[];
  complexity: TaskComplexity;
};

export type TaskStep = {
  id: string;
  description: string;
  action: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  output?: string;
};

export type TaskPlan = {
  type: "direct" | "multi_step";
  steps: TaskStep[];
};

export type VerificationState = "verified" | "unverified" | "failed" | "requires_evidence";

export type OrchestratorVerification = {
  state: VerificationState;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  sourceFiles?: string[];
};

export type TaskExecutionState =
  | "pending"
  | "planning"
  | "routing"
  | "executing"
  | "verifying"
  | "completed"
  | "failed";

export type TaskError = {
  code: string;
  message: string;
  stage: string;
  timestamp: string;
};

export type StageTimestamps = {
  receivedAt: string;
  classifiedAt?: string;
  plannedAt?: string;
  routedAt?: string;
  executedAt?: string;
  verifiedAt?: string;
  completedAt?: string;
};

export type OrchestratorTask = {
  requestId: string;
  userId?: string;
  conversationId: string;
  prompt: string;
  intent: TaskIntent;
  classification: ClassificationResult;
  context: {
    recentMessages: ChatTurn[];
    documentEvidence?: string;
    memoryFacts?: string;
    tokenEstimate?: number;
  };
  plan: TaskPlan;
  selectedProvider: string;
  model: string;
  executionState: TaskExecutionState;
  result?: {
    content: string;
    finishReason?: string;
  };
  searchUsed?: boolean;
  sources?: SearchSource[];
  images?: GeneratedImageItem[];
  verification: OrchestratorVerification;
  errors?: TaskError[];
  timestamps: StageTimestamps;
};

export type OrchestratorExecuteInput = {
  requestId?: string;
  userId?: string;
  conversationId: string;
  prompt: string;
  messages?: Array<{ role: string; content: string }>;
  documentContext?: string;
  documentIds?: string[];
  memoryContext?: string;
  providerId?: string;
  modelOverride?: string;
  language?: "en" | "hi";
  enableSearch?: boolean;
  notebookId?: string;
  isPrivateOnly?: boolean;
};

export type OrchestratorStreamEvent =
  | { type: "stage"; stage: string; details?: Record<string, unknown> }
  | { type: "memory_suggestion"; suggestion: string }
  | { type: "chunk"; content: string }
  | { type: "sources"; sources: SearchSource[] }
  | { type: "image"; image: GeneratedImageItem; images?: GeneratedImageItem[] }
  | { type: "done"; assistant?: unknown; task: OrchestratorTask }
  | { type: "error"; error: string; code?: string };

