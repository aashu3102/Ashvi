import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function parseCommandArgs(value: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed as string[];
  } catch {
    // Invalid configuration is reported when the provider is used.
  }
  return fallback;
}

export function substituteArgs(args: string[], values: Record<string, string>) {
  return args.map((arg) => arg.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? ""));
}

export async function runVoiceCommand(command: string, args: string[], timeoutMs: number) {
  try {
    return await execFileAsync(command, args, { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown command failure.";
    throw new Error(detail);
  }
}
