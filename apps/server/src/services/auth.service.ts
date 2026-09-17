import { createHmac, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import type { Environment } from "../config/env.js";

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const lockDurationMs = 30 * 60 * 1000;
const maxAttempts = 3;
const genericFailure = "Access could not be verified.";

type IdentitySlot = { name?: string; codeHash?: string; passwordHash?: string };

function identitySlots(environment: Environment): IdentitySlot[] {
  return [
    { name: environment.ASHVI_USER_A_NAME, codeHash: environment.ASHVI_USER_A_CODE_HASH, passwordHash: environment.ASHVI_USER_A_PASSWORD_HASH },
    { name: environment.ASHVI_USER_B_NAME, codeHash: environment.ASHVI_USER_B_CODE_HASH, passwordHash: environment.ASHVI_USER_B_PASSWORD_HASH },
  ];
}

function sessionHash(token: string, secret: string) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

function signalHash(signal: string, secret: string) {
  return createHmac("sha256", secret).update(signal).digest("hex");
}

async function ensureIdentity(db: PrismaClient, identity: IdentitySlot) {
  if (!identity.name) throw new Error("Identity name is not configured.");
  return db.user.upsert({
    where: { username: identity.name },
    update: { name: identity.name },
    create: { username: identity.name, name: identity.name },
  });
}

export async function initializeIdentities(db: PrismaClient, environment: Environment) {
  const identities = identitySlots(environment);
  const names = identities.map((identity) => identity.name);
  const codeHashes = identities.map((identity) => identity.codeHash);
  const passwordHashes = identities.map((identity) => identity.passwordHash);
  if (
    !environment.ASHVI_SESSION_SECRET ||
    identities.some((identity) => !identity.name || !identity.codeHash || !identity.passwordHash) ||
    new Set(names).size !== identities.length ||
    codeHashes[0] === codeHashes[1] ||
    passwordHashes[0] === passwordHashes[1]
  ) {
    throw new Error("Two complete Ashvi credential slots are required before the server can start.");
  }
  for (const identity of identities) await ensureIdentity(db, identity);
}

export async function authenticate(db: PrismaClient, environment: Environment, username: string, code: string, password: string, ip: string) {
  const identities = identitySlots(environment);
  const now = new Date();
  const signalKey = signalHash(ip, environment.ASHVI_SESSION_SECRET ?? "");
  const signalState = await db.authRateLimit.findUnique({ where: { keyHash: signalKey } });
  if (signalState?.lockedUntil && signalState.lockedUntil > now) throw new Error(genericFailure);
  const identity = identities.find((candidate) => candidate.name === username);
  const selectedUser = identity ? await ensureIdentity(db, identity) : null;
  const state = selectedUser ? await db.authState.findUnique({ where: { userId: selectedUser.id } }) : null;
  const locked = state?.lockedUntil && state.lockedUntil > now;
  const codeMatches = await argon2.verify(identity?.codeHash ?? "$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid", code).catch(() => false);
  const passwordMatches = await argon2.verify(identity?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid", password).catch(() => false);

  if (!selectedUser || locked || !codeMatches || !passwordMatches) {
    if (selectedUser && !locked) {
      const failedAttempts = (state?.failedAttempts ?? 0) + 1;
      await db.authState.upsert({
        where: { userId: selectedUser.id },
        update: { failedAttempts, lastFailedAt: now, lockedUntil: failedAttempts >= maxAttempts ? new Date(now.getTime() + lockDurationMs) : null },
        create: { userId: selectedUser.id, failedAttempts, lastFailedAt: now, lockedUntil: failedAttempts >= maxAttempts ? new Date(now.getTime() + lockDurationMs) : null },
      });
    }
    const failedAttempts = (signalState?.failedAttempts ?? 0) + 1;
    await db.authRateLimit.upsert({
      where: { keyHash: signalKey },
      update: { failedAttempts, lastFailedAt: now, lockedUntil: failedAttempts >= maxAttempts ? new Date(now.getTime() + lockDurationMs) : null },
      create: { keyHash: signalKey, failedAttempts, lastFailedAt: now, lockedUntil: failedAttempts >= maxAttempts ? new Date(now.getTime() + lockDurationMs) : null },
    });
    void ip;
    throw new Error(genericFailure);
  }

  await db.authState.upsert({ where: { userId: selectedUser.id }, update: { failedAttempts: 0, lockedUntil: null }, create: { userId: selectedUser.id } });
  await db.authRateLimit.deleteMany({ where: { keyHash: signalKey } });
  const token = randomBytes(32).toString("base64url");
  await db.authSession.create({ data: { userId: selectedUser.id, tokenHash: sessionHash(token, environment.ASHVI_SESSION_SECRET ?? "") , expiresAt: new Date(now.getTime() + sessionLifetimeMs) } });
  return { token, user: { id: selectedUser.id, name: selectedUser.name } };
}

export async function resolveSession(db: PrismaClient, token: string, secret = "") {
  const session = await db.authSession.findUnique({ where: { tokenHash: sessionHash(token, secret) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await db.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const now = new Date();
  await db.authSession.update({
    where: { id: session.id },
    data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + sessionLifetimeMs) },
  });
  return { sessionId: session.id, user: session.user };
}

export async function revokeSession(db: PrismaClient, token: string, secret = "") {
  await db.authSession.deleteMany({ where: { tokenHash: sessionHash(token, secret) } });
}
