
import { observable } from '@trpc/server/observable';
import { ChatMessage } from 'chatgpt';
import EventEmitter from "node:events";
import { z } from "zod";
import { SendMessageOptionsSchema, chatgpt } from './chatgpt';
import { publicProcedure, router } from "./trpc";
import { Configuration, OpenAIApi } from 'openai'
import { runAppleScript } from './runAppleScript';


const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


const eventsMap = new Map<string, EventEmitter>();

export const appRouter = router({
  hello: publicProcedure.query(() => "hi"),
  chat: router({
    onProgress: publicProcedure.input(z.object({
      id: z.string(),
    })).subscription(({ input }) => {
      return observable<ChatMessage>((emit) => {
        if (!eventsMap.has(input.id)) {
          eventsMap.set(input.id, new EventEmitter())
        }
        const ee = eventsMap.get(input.id)!
        const onProgress = (data: ChatMessage) => {
          // emit data to client
          emit.next(data);
        };
        // trigger `onAdd()` when `add` is triggered in our event emitter
        ee.on('onProgress', onProgress);
        // unsubscribe function when client disconnects or stops subscribing
        return () => {
          ee.off('onProgress', onProgress);
          eventsMap.delete(input.id)
        };
      })
    }),
    completion: publicProcedure.input(z.object({
      id: z.string(),
      message: z.string()
    })).mutation(async ({ input }) => {
      const prompt = `You are a thoughtful assistant that helps the user do tasks on their MacBook. Answer as concisely as possible for each response (e.g. don’t be verbose). When it makes sense, use markdown syntax to output code, links, tables, etc. If outputting code, include the programming language. It is possible to interact with applications for the user via JavaScript, which will be executed through the "osascript" command. Use the examples below as a guide. ALWAYS include the "sendReply" function at the end of your response. This will send the response to the user.

Context:
Your contacts:
- Tiffany Sun: tiffanysun8@gmail.com
- Alex Gravely: alex@minion.ai

Example 1:
Task: invite tiffany to dinner on friday night
Context:
app.currentDate() == Mon, 22 Feb 2023 22:29:10 GMT
Output:
\`\`\`js
let app = Application.currentApplication()
app.includeStandardAdditions = true
let Calendar = Application("Calendar")

let eventStart = app.currentDate()
// add days until friday. 0 = today, 1 = tomorrow, etc. Since today is Monday, we want to add 4 days.
const targetDate = eventStart.getDate() + 4;
eventStart.setDate(targetDate)
eventStart.setHours(17)
eventStart.setMinutes(0)
eventStart.setSeconds(0)
let eventEnd = new Date(eventStart.getTime())
eventEnd.setHours(18)

let projectCalendars = Calendar.calendars.whose({name: "Home"})
let projectCalendar = projectCalendars[0]
let event = Calendar.Event({summary: "Dinner", startDate: eventStart, endDate: eventEnd})
projectCalendar.events.push(event)

let attendee = Calendar.Attendee({email: "tiffanysun8@gmail.com"})
event.attendees.push(attendee)

Calendar.reloadCalendars()

sendReply("Ok! I scheduled dinner for you on Friday at 5pm, and sent an invitation to Tiffany.")
\`\`\`

Begin.
Context:
app.currentDate() == ${new Date().toUTCString()}
Task: ${input.message}
Output:
\`\`\`js`
      // console.log(prompt);
      const completion = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        stop: ["```"],
        max_tokens: 500,
        temperature: 0
      })
      const text = completion.data.choices[0].text || ""
      console.log({ completion: text });
      // regular expression to match the text between sendReply(" and ")
      const reply = text.match(/sendReply\("(.*)"\)/)?.[1] || ""
      const chatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: reply
      } satisfies ChatMessage;
      if (!eventsMap.has(input.id)) {
        eventsMap.set(input.id, new EventEmitter())
      }
      eventsMap.get(input.id)?.emit('onProgress', chatMessage)
      const script = text.match(/```js(.*)```/s)?.[1] || ""
      const beforeSendReply = text.split("sendReply")[0]

      const appleScriptResult = await runAppleScript({
        script: beforeSendReply,
        jxa: true
      })
      console.log("AppleScript code execution:");
      console.log(appleScriptResult);

      return {
        script
      }
    }),
    sendMessage: publicProcedure.input(z.object({
      id: z.string(),
      message: z.string(),
    }).merge(SendMessageOptionsSchema)).mutation(async ({ input }) => {
      const { message, ...rest } = input
      const response = await chatgpt.sendMessage(message, {
        ...rest,
        onProgress(partialResponse) {
          if (!eventsMap.has(input.id)) {
            eventsMap.set(input.id, new EventEmitter())
          }
          eventsMap.get(input.id)?.emit('onProgress', partialResponse)
        },
      })
      return response
    })
  })
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;