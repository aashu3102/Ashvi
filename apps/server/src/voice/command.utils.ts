import { spawn } from "node:child_process";

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

export async function runVoiceCommand(command: string, args: string[], timeoutMs: number, input?: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error("Local voice command timed out."));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 2 * 1024 * 1024) finish(new Error("Local voice command output was too large."));
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 2 * 1024 * 1024) finish(new Error("Local voice command error output was too large."));
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(stderr.trim() || `Local voice command exited with code ${code ?? "unknown"}.`));
    });

    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}
