import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const user = `document-test-${Date.now()}`;
const code = "document-code";
const password = "document-password";
const [codeHash, passwordHash] = await Promise.all([argon2.hash(code), argon2.hash(password)]);
const app = buildApp(loadEnvironment({
  ...process.env,
  NODE_ENV: "test",
  ASHVI_LOG_LEVEL: "silent",
  ASHVI_SESSION_SECRET: "document-test-session-secret-that-is-long-enough",
  ASHVI_USER_A_NAME: user,
  ASHVI_USER_A_CODE_HASH: codeHash,
  ASHVI_USER_A_PASSWORD_HASH: passwordHash,
  ASHVI_USER_B_NAME: `document-test-b-${Date.now()}`,
  ASHVI_USER_B_CODE_HASH: codeHash,
  ASHVI_USER_B_PASSWORD_HASH: passwordHash,
}), { withAuth: true });

function multipartText(filename: string, content: string) {
  const boundary = "ashvi-document-test";
  return {
    body: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

let cookie = "";
beforeAll(async () => {
  await app.ready();
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: user, code, password } });
  cookie = `ashvi_session=${login.cookies.find((item) => item.name === "ashvi_session")?.value}`;
});
afterAll(async () => {
  await app.prisma.document.deleteMany({ where: { filename: "integration.txt" } });
  await app.prisma.user.deleteMany({ where: { username: { startsWith: "document-test-" } } });
  await app.close();
});

describe("document upload and ownership", () => {
  it("uploads, extracts, and previews a TXT document", async () => {
    const multipart = multipartText("integration.txt", "Ashvi integration extraction marker.");
    const uploaded = await app.inject({ method: "POST", url: "/api/documents/upload", headers: { "content-type": multipart.contentType, cookie }, payload: multipart.body });
    expect(uploaded.statusCode).toBe(201);
    const id = uploaded.json().id as string;

    let preview = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await app.inject({ method: "GET", url: `/api/documents/${id}/preview`, headers: { cookie } });
      preview = response.json().preview ?? "";
      if (preview) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(preview).toContain("Ashvi integration extraction marker.");
  });
});