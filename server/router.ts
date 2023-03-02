import { observable } from "@trpc/server/observable";
import { ChatMessage } from "chatgpt";
import EventEmitter from "node:events";
import { z } from "zod";
import { SendMessageOptionsSchema, chatgpt } from "./chatgpt";
import { publicProcedure, router } from "./trpc";
import { appleCalendar } from "./prompts/appleCalendar";
import { openai } from "./utils/openai";

const eventsMap = new Map<string, EventEmitter>();

export const appRouter = router({
  hello: publicProcedure.query(() => "hi"),
  chat: router({
    onProgress: publicProcedure
      .input(
        z.object({
          id: z.string(),
        })
      )
      .subscription(({ input }) => {
        return observable<ChatMessage>((emit) => {
          if (!eventsMap.has(input.id)) {
            eventsMap.set(input.id, new EventEmitter());
          }
          const ee = eventsMap.get(input.id)!;
          const onProgress = (data: ChatMessage) => {
            // emit data to client
            emit.next(data);
          };
          // trigger `onAdd()` when `add` is triggered in our event emitter
          ee.on("onProgress", onProgress);
          // unsubscribe function when client disconnects or stops subscribing
          return () => {
            ee.off("onProgress", onProgress);
            eventsMap.delete(input.id);
          };
        });
      }),
    completion: publicProcedure
      .input(
        z.object({
          id: z.string(),
          message: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { reply, script } = await appleCalendar(input);

        const chatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: reply,
        } satisfies ChatMessage;

        if (!eventsMap.has(input.id)) {
          eventsMap.set(input.id, new EventEmitter());
        }
        eventsMap.get(input.id)?.emit("onProgress", chatMessage);

        return {
          script,
        };
      }),
    sendMessage: publicProcedure
      .input(
        z
          .object({
            id: z.string(),
            message: z.string(),
          })
          .merge(SendMessageOptionsSchema)
      )
      .mutation(async ({ input }) => {
        const { message, ...rest } = input;
        const response = await chatgpt.sendMessage(message, {
          ...rest,
          onProgress(partialResponse) {
            if (!eventsMap.has(input.id)) {
              eventsMap.set(input.id, new EventEmitter());
            }
            eventsMap.get(input.id)?.emit("onProgress", partialResponse);
          },
        });
        return response;
      }),
  }),
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
