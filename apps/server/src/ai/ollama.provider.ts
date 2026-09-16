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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;

        try {
          const payload = JSON.parse(data) as { message?: { content?: string } };
          const content = payload.message?.content;
          if (content) yield content;
        } catch {
          // Ignore malformed stream chunks and continue to the next event.
        }
      }
    }

    if (buffer.trim().startsWith("data:")) {
      const data = buffer.trim().slice(5).trim();
      if (data !== "[DONE]") {
        try {
          const payload = JSON.parse(data) as { message?: { content?: string } };
          const content = payload.message?.content;
          if (content) yield content;
        } catch {
          // Ignore malformed final stream chunks.
        }
      }
    }
  }
}
