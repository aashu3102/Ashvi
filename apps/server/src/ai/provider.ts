export type ChatTurn = { role: "user" | "assistant" | "system"; content: string };
export interface AIProvider {
  chat(messages: ChatTurn[]): Promise<string>;
  chatStream?(messages: ChatTurn[]): AsyncIterable<string>;
}
