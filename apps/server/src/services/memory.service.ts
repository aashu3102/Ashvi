import type { MemoryCategory, MemorySource, PrismaClient } from "@prisma/client";

const localUser = { email: "local@ashvi.local", name: "Local user" };
const stopWords = new Set(["about", "after", "again", "also", "because", "before", "could", "from", "have", "into", "more", "over", "should", "that", "their", "there", "these", "this", "those", "what", "when", "where", "which", "while", "with", "would", "your"]);

function terms(value: string) {
	return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((term) => term.length > 2 && !stopWords.has(term)));
}

async function ownerId(db: PrismaClient, authenticatedUserId?: string) {
 if (authenticatedUserId) return authenticatedUserId;
	const user = await db.user.upsert({ where: { email: localUser.email }, update: {}, create: localUser });
	return user.id;
}

export async function listMemory(db: PrismaClient, authenticatedUserId?: string) {
 return db.memory.findMany({ where: { userId: await ownerId(db, authenticatedUserId) }, orderBy: [{ importance: "desc" }, { updatedAt: "desc" }] });
}

export async function createMemory(db: PrismaClient, data: { content: string; category: MemoryCategory; source: MemorySource; importance?: number }, authenticatedUserId?: string) {
 return db.memory.create({ data: { ...data, userId: await ownerId(db, authenticatedUserId) } });
}

export async function updateMemory(db: PrismaClient, id: string, data: { content?: string; category?: MemoryCategory; importance?: number }, authenticatedUserId?: string) {
 const result = await db.memory.updateMany({ where: { id, userId: await ownerId(db, authenticatedUserId) }, data });
	return result.count > 0 ? db.memory.findUnique({ where: { id } }) : null;
}

export async function deleteMemory(db: PrismaClient, id: string, authenticatedUserId?: string) {
 const result = await db.memory.deleteMany({ where: { id, userId: await ownerId(db, authenticatedUserId) } });
	return result.count > 0;
}

export async function retrieveRelevantMemories(db: PrismaClient, query: string, authenticatedUserId?: string, limit = 5) {
	const queryTerms = terms(query);
	if (queryTerms.size === 0) return "";

	 const memories = await db.memory.findMany({ where: { userId: await ownerId(db, authenticatedUserId) } });
	const ranked = memories.map((memory) => {
		const memoryTerms = terms(memory.content);
		const overlap = [...queryTerms].filter((term) => memoryTerms.has(term)).length;
		const relevance = overlap / Math.max(queryTerms.size, 1);
		const importance = memory.importance / 5;
		const ageDays = Math.max(0, (Date.now() - memory.updatedAt.getTime()) / 86_400_000);
		const freshness = 1 / (1 + ageDays / 30);
		return { memory, score: relevance * 0.7 + importance * 0.2 + freshness * 0.1 };
	}).filter(({ score }) => score > 0.14).sort((left, right) => right.score - left.score).slice(0, limit);

	return ranked.map(({ memory }) => `[${memory.category}, importance ${memory.importance}/5]\n${memory.content}`).join("\n\n");
}

export function suggestMemory(content: string) {
	const normalized = content.trim().replace(/\s+/g, " ");
	if (normalized.length < 12 || normalized.length > 500) return null;

	const preference = /\b(i prefer|i like|i dislike|i hate|please always|please never|my preference is)\b/i.test(normalized);
	const instruction = /\b(remember that|keep in mind|from now on|always|never)\b/i.test(normalized);
	const fact = /\b(my name is|i am|i work|i live|my project is|we are building)\b/i.test(normalized);
	if (!preference && !instruction && !fact) return null;

	return {
		content: normalized,
		category: preference ? "PREFERENCE" : instruction ? "INSTRUCTION" : "FACT",
		source: "USER",
		importance: preference || instruction ? 4 : 3,
	} as const;
}
