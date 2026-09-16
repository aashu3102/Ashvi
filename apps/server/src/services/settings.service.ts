import type { Prisma, PrismaClient } from "@prisma/client";

const localUser = { email: "local@ashvi.local", name: "Local user" };

async function ownerId(db: PrismaClient, authenticatedUserId?: string) {
  if (authenticatedUserId) return authenticatedUserId;
  const user = await db.user.upsert({
    where: { email: localUser.email },
    update: {},
    create: localUser,
  });

  return user.id;
}

export async function getSettings(db: PrismaClient, authenticatedUserId?: string) {
  const userId = await ownerId(db, authenticatedUserId);

  return db.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, preferences: {} },
  });
}

export async function updateSettings(db: PrismaClient, preferences: Record<string, unknown>, authenticatedUserId?: string) {
  const userId = await ownerId(db, authenticatedUserId);
  const payload = preferences as Prisma.JsonObject;

  return db.userSettings.upsert({
    where: { userId },
    update: { preferences: payload },
    create: { userId, preferences: payload },
  });
}
