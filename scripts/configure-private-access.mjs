import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import argon2 from "argon2";

const envPath = new URL("../.env", import.meta.url);

function ask(label) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => input.question(label, (answer) => { input.close(); resolve(answer.trim()); }));
}

function askSecret(label) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(label);
    stdin.setRawMode?.(true);
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      const key = chunk.toString();
      if (key === "\u0003") {
        cleanup();
        reject(new Error("Setup cancelled."));
      } else if (key === "\r" || key === "\n") {
        process.stdout.write("\n");
        cleanup();
        resolve(value);
      } else if (key === "\u0008" || key === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += key;
      }
    };
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode?.(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

function setEnv(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
}

const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
console.log("Ashvi private access setup. Credentials are entered locally and never printed.");

try {
  const users = [];
  for (const slot of ["A", "B"]) {
    const name = await ask(`User ${slot} identity name: `);
    const code = await askSecret(`User ${slot} secret access code: `);
    const password = await askSecret(`User ${slot} password: `);
    if (!name || !code || password.length < 12) throw new Error("Each identity needs a name, code, and password of at least 12 characters.");
    users.push({ slot, name, codeHash: await argon2.hash(code, { type: argon2.argon2id }), passwordHash: await argon2.hash(password, { type: argon2.argon2id }) });
  }

  let output = setEnv(current, "ASHVI_SESSION_SECRET", randomBytes(32).toString("base64url"));
  for (const user of users) {
    output = setEnv(output, `ASHVI_USER_${user.slot}_NAME`, user.name);
    output = setEnv(output, `ASHVI_USER_${user.slot}_CODE_HASH`, user.codeHash);
    output = setEnv(output, `ASHVI_USER_${user.slot}_PASSWORD_HASH`, user.passwordHash);
  }
  writeFileSync(envPath, output, { mode: 0o600 });
  console.log("Private access configured for two identities. No plaintext credentials were written.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Private access setup failed.");
  process.exitCode = 1;
}
