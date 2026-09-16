export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type ConversationSummary = { id: string; title: string; createdAt: string; updatedAt: string };
export type ChatMessage = { id: string; role: MessageRole; content: string; createdAt: string };
