import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string(),
  role: z.string(),
  status: z.string(),
  department_id: z.number().nullable().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  user: UserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const MessageSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: z.number(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number().optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ChatAttachmentSchema = z.object({
  id: z.number(),
  file_name: z.string(),
  file_type: z.string(),
  file_category: z.string(),
  file_size: z.number(),
  status: z.string(),
  error_message: z.string().nullable(),
  created_at: z.string(),
});
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

export const KnowledgeBaseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  kb_type: z.string(),
  department_id: z.number().nullable().optional(),
  project_id: z.number().nullable().optional(),
  created_by: z.number(),
  created_at: z.string(),
  document_count: z.number(),
});
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;

export const DocumentSchema = z.object({
  id: z.number(),
  knowledge_base_id: z.number(),
  file_name: z.string(),
  file_type: z.string(),
  file_size: z.number(),
  uploaded_by: z.number(),
  processing_status: z.enum(['uploaded', 'processing', 'ready', 'failed']),
  error_message: z.string().nullable(),
  created_at: z.string(),
});
export type KBDocument = z.infer<typeof DocumentSchema>;

export const ChunkSourceSchema = z.object({
  document_id: z.number(),
  file_name: z.string(),
  chunk_index: z.number(),
  chunk_text: z.string(),
  similarity_score: z.number(),
});
export type ChunkSource = z.infer<typeof ChunkSourceSchema>;

export function isAdminRole(role: string): boolean {
  return role === 'super_admin' || role === 'admin';
}
