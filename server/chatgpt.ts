import { ChatGPTAPI } from "chatgpt";
import { z } from 'zod';
import { env } from "./env";

const Role = z.enum(['user', 'assistant']);
export const SendMessageOptionsSchema = z.object({
  conversationId: z.string().optional(),
  parentMessageId: z.string().optional(),
  messageId: z.string().optional(),
  stream: z.boolean().optional(),
  promptPrefix: z.string().optional(),
  promptSuffix: z.string().optional(),
  timeoutMs: z.number().optional(),
  // onProgress: z.function(z.object({ id: z.string(), text: z.string(), role: Role }).optional()).optional(),
  // abortSignal: z.instanceof(AbortSignal).optional(),
});
export const ChatMessage = z.object({
  id: z.string(),
  text: z.string(),
  role: Role,
  parentMessageId: z.string().optional(),
  conversationId: z.string().optional(),
  detail: z.any().optional(),
});

export const chatgpt = new ChatGPTAPI({
  apiKey: env.OPENAI_API_KEY, debug: false,
})
