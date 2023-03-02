
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

Your contacts:
- Austin Wang: austinpowers1258@gmail.com
- Lawrence Chen: lawrence@minion.ai
- Alex Gravely: alex@minion.ai
- Kaushik Patnaik kaushik@minion.ai
- Subhash Ramesh subhash@minion.ai

Calendar convetions:
Monday = 0
...
Sunday = 6

Example 1:
Task: invite subhash and kaushik to dinner on friday night
Context:
app.currentDate() == Monday, February 20, 2023 at 4:11:25 PM
Output:
\`\`\`js
let app = Application.currentApplication()
app.includeStandardAdditions = true
let Calendar = Application("Calendar")

let eventStart = app.currentDate()
let today = app.currentDate()
const startDate = eventStart.getDate() - today.getDay() + 5;
eventStart.setDate(startDate)
eventStart.setHours(17)
eventStart.setMinutes(0)
eventStart.setSeconds(0)
let eventEnd = new Date(eventStart.getTime())
eventEnd.setHours(18)

let projectCalendars = Calendar.calendars.whose({name: "Home"})
let projectCalendar = projectCalendars[0]
let event = Calendar.Event({summary: "Dinner with Subhash", startDate: eventStart, endDate: eventEnd})
projectCalendar.events.push(event)

event.attendees.push(Calendar.Attendee({email: "subhash@minion.ai"}))
event.attendees.push(Calendar.Attendee({email: "kaushik@minion.ai"}))

Calendar.reloadCalendars()

sendReply("Ok! I scheduled dinner for you on Friday at 5pm, and sent an invitation to Subhash and Kaushik.")
\`\`\`


Example 2:
Task: clear all events for this week
Context:
app.currentDate() == Monday, February 20, 2023 at 4:11:25 PM
Output:
\`\`\`js
let app = Application.currentApplication()
app.includeStandardAdditions = true
let Calendar = Application("Calendar")

let today = app.currentDate()
let startDate = new Date(today.getTime())
startDate.setDate(today.getDate() - today.getDay())
startDate.setHours(0)
startDate.setMinutes(0)
startDate.setSeconds(0)
let endDate = new Date(startDate.getTime())
endDate.setDate(startDate.getDate() + 6)
endDate.setHours(23)
endDate.setMinutes(59)
endDate.setSeconds(59)

let projectCalendars = Calendar.calendars.whose({name: "Home"})
let projectCalendar = projectCalendars[0]
let events = projectCalendar.events.whose({
	_and: [
		{ startDate: {_greaterThan: startDate }},
		{ endDate: {_lessThanEquals: endDate }}
	]})

events().forEach(event => {
  Calendar.delete(projectCalendar.events.byId(event.id()))
})

Calendar.reloadCalendars()

sendReply("Ok! I cleared all of your events for this week.")
\`\`\`

Example 3:
Task: invite subhash to dinner from thursday to the rest of the week
Context:
app.currentDate() == Monday, February 20, 2023 at 4:11:25 PM
Output:
\`\`\`js
let app = Application.currentApplication()
app.includeStandardAdditions = true
let Calendar = Application("Calendar")

let projectCalendars = Calendar.calendars.whose({name: "Home"})
let projectCalendar = projectCalendars[0]

// add dinner events for thursday, friday, saturday, and sunday
// since today is monday and we want to start on thursday and end on sunday, the index starts at 4 and ends at 6
for (let i = 4; i <= 6; i++) {
  let today = app.currentDate()
  let eventStart = app.currentDate()
  const startDate = today.getDate() - today.getDay() + i;
  eventStart.setDate(startDate)
  eventStart.setHours(17)
  eventStart.setMinutes(0)
  eventStart.setSeconds(0)
  let eventEnd = new Date(eventStart.getTime())
  eventEnd.setHours(18)

  let event = Calendar.Event({summary: "Dinner with Subhash", startDate: eventStart, endDate: eventEnd})
  projectCalendar.events.push(event)
  event.attendees.push(Calendar.Attendee({email: "subhash@minion.ai"}))
}

Calendar.reloadCalendars()

sendReply("Ok! I scheduled dinner on Thursday, Friday, Saturday, and Sunday at 5pm. I've also sent an invitation to Subhash on all 4 days.")
\`\`\`


Begin.
Task: ${input.message}
Context:
app.currentDate() == ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })}
Output:
\`\`\`js`
      console.log(prompt);
      const completion = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt,
        stop: ["```"],
        max_tokens: 700,
        temperature: 0,
      })
      const text = completion.data.choices[0].text || ""
      console.log(text);
      // regular expression to match the text between sendReply(" and ")
      // const regex = /^sendReply\(['"`]([^'"`]*)['"`]/gms;
      // const reply = regex.exec(text)?.[1] || "";
      // const reply = text.match(regex)?.[1] || ""
      // const reply = text.match(/sendReply\(["|'|`](.*)["|'|`]\)/gms)?.[1] || ""

      let reply = text.split("sendReply")[1]
      reply = reply.substring(2, reply.length - 3).replaceAll("\\`", "`")

      console.log({ reply });
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