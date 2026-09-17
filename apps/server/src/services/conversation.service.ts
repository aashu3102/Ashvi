import type { Prisma, PrismaClient } from "@prisma/client";

const defaultUser = { email: "local@ashvi.local", name: "Local user" };

async function userId(db: PrismaClient, authenticatedUserId?: string) {
  if (authenticatedUserId) return authenticatedUserId;
  const user = await db.user.upsert({ where: { email: defaultUser.email }, update: {}, create: defaultUser });
  return user.id;
}

export async function listConversations(db: PrismaClient, authenticatedUserId?: string) {
  const id = await userId(db, authenticatedUserId);
  return db.conversation.findMany({
    where: { userId: id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function createConversation(db: PrismaClient, title?: string, authenticatedUserId?: string) {
  return db.conversation.create({ data: { userId: await userId(db, authenticatedUserId), title: title ?? "New conversation" } });
}

export async function getConversation(db: PrismaClient, id: string, authenticatedUserId?: string) {
  const ownerId = await userId(db, authenticatedUserId);
  return db.conversation.findFirst({ where: { id, userId: ownerId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
}

export async function addUserMessage(db: PrismaClient, conversationId: string, content: string, authenticatedUserId?: string) {
  const conversation = await getConversation(db, conversationId, authenticatedUserId);
  if (!conversation) return null;
  return db.message.create({ data: { conversationId, role: "USER", content } });
}

export async function addAssistantMessage(db: PrismaClient, conversationId: string, content: string, metadata?: Prisma.InputJsonValue) {
  return db.message.create({ data: { conversationId, role: "ASSISTANT", content, metadata: metadata ?? undefined } });
}

export async function renameConversation(db: PrismaClient, id: string, title: string, authenticatedUserId?: string) {
  const conversation = await getConversation(db, id, authenticatedUserId);
  return conversation ? db.conversation.update({ where: { id }, data: { title } }) : null;
}

export async function deleteConversation(db: PrismaClient, id: string, authenticatedUserId?: string) {
  const conversation = await getConversation(db, id, authenticatedUserId);
  if (!conversation) return false;
  await db.conversation.delete({ where: { id } });
  return true;
}
