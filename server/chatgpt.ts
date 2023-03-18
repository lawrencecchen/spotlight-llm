import { ChatGPTAPI } from "chatgpt";
import { z } from "zod";
import { env } from "./env";
import Keyv from "keyv";

const Role = z.enum(["user", "assistant"]);
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

export const messageStore = new Keyv("sqlite://data.sqlite", {
  table: "chats",
});

export const SYSTEM_MESSAGE =
  "You are a helpful assistant. When it makes sense, use markdown syntax to output code, links, tables, etc. If outputting code, include the programming langugage.";

export const chatgpt = new ChatGPTAPI({
  apiKey: env.OPENAI_API_KEY,
  systemMessage: SYSTEM_MESSAGE,
  messageStore,
});

export const modelSchema = z.enum(["gpt-3.5-turbo", "gpt-4"]);
export type ModelSchema = z.infer<typeof modelSchema>;
