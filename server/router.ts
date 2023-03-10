import { observable } from "@trpc/server/observable";
import { ChatMessage } from "chatgpt";
import EventEmitter from "node:events";
import { z } from "zod";
import { SendMessageOptionsSchema, chatgpt } from "./chatgpt";
import { publicProcedure, router } from "./trpc";
import { appleCalendar } from "./prompts/appleCalendar";
import { openai } from "./utils/openai";
import { decideTool } from "./utils/toolRouter";

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

        const tool = await decideTool({ message: input.message });

        console.log("tool", tool);

        function emit(message: ChatMessage) {
          if (!eventsMap.has(input.id)) {
            eventsMap.set(input.id, new EventEmitter());
          }
          eventsMap.get(input.id)?.emit("onProgress", message);
        }

        switch (tool) {
          case "ChatGPT": {
            const response = await chatgpt.sendMessage(message, {
              ...rest,
              onProgress(partialResponse) {
                emit(partialResponse);
              },
            });
            return response;
          }
          case "Calendar": {
            emit({
              id: crypto.randomUUID(),
              role: "assistant",
              text: "Setting up calendar event...",
            });
            const { reply } = await appleCalendar({
              message: input.message,
            });
            const chatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              text: reply,
            } satisfies ChatMessage;
            emit(chatMessage);
            return chatMessage;
          }
          default:
            throw new Error("Unknown tool");
        }
      }),
    summarize: publicProcedure
      .input(z.object({ userInput: z.string(), assistantOutput: z.string() }))
      .mutation(async ({ input }) => {
        const response = await openai.createChatCompletion({
          model: "gpt-3.5-turbo-0301",
          messages: [
            {
              role: "user",
              content: input.userInput,
            },
            {
              role: "assistant",
              content: input.assistantOutput,
            },
            {
              role: "user",
              content: `Summarize our conversation in 5 words or less.`,
            },
          ],
        });
        const withoutEndingPunctation =
          response.data.choices[0].message?.content.replace(/[\.\?\!]$/, "");
        return withoutEndingPunctation;
      }),
  }),
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
