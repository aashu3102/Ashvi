import { z } from "zod";

export const createConversationSchema = z.object({ title: z.string().trim().min(1).max(160).optional() });
export const updateConversationSchema = z.object({ title: z.string().trim().min(1).max(160) });
export const createMessageSchema = z.object({ content: z.string().trim().min(1).max(50_000) });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
