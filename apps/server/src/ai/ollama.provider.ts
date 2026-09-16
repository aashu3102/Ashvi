import type { AIProvider, ChatTurn } from "./provider.js";

export class OllamaProvider implements AIProvider {
  constructor(private readonly baseUrl: string, private readonly model: string) {}

  async chat(messages: ChatTurn[]) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });

    if (!response.ok) throw new Error("Local AI provider failed.");

    const body = (await response.json()) as { message?: { content?: string } };
    if (!body.message?.content) throw new Error("Local AI provider returned no response.");
    return body.message.content;
  }

  async *chatStream(messages: ChatTurn[]) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });

    if (!response.ok) throw new Error("Local AI provider failed.");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Local AI provider stream was unavailable.");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const content = parseStreamLine(line);
        if (content) yield content;
      }
    }

    const content = parseStreamLine(buffer);
    if (content) yield content;
  }
}

function parseStreamLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return "";

  const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === "[DONE]") return "";

  try {
    const payload = JSON.parse(data) as { message?: { content?: string } };
    return payload.message?.content ?? "";
  } catch {
    return "";
  }
}
