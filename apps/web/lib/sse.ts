export type AshviStreamEvent = {
  type?: "chunk" | "memory_suggestion" | "done" | "error";
  content?: string;
  error?: string;
  assistant?: { id: string; role: string; content: string };
};

export function parseAshviSseLine(line: string): AshviStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  try {
    return JSON.parse(trimmed.slice(5).trim()) as AshviStreamEvent;
  } catch {
    return { type: "error", error: "Ashvi returned an invalid streaming response." };
  }
}