import { OpenAIApi } from "openai";
import { z } from "zod";

export async function decideTool(opts: { message: string; openai: OpenAIApi }) {
  return "ChatGPT";
  const taskRouterPrompt = `Decide what tools to use to respond to a user message. Possible tools:
- Calendar
- ChatGPT

Example 1:
Message: open image in pil
Tool: ChatGPT

Example 2:
Message: schedule lunch tomorrow noon
Tool: Calendar

Example 3:
Message: ${opts.message}
Tool: `;

  const completion = await opts.openai.createChatCompletion({
    model: "gpt-3.5-turbo-0301",
    messages: [
      {
        role: "user",
        content: taskRouterPrompt,
      },
    ],
    max_tokens: 20,
    temperature: 0,
  });

  const text = completion.data.choices[0].message?.content || "";

  const toolSchema = z.enum(["Calendar", "ChatGPT"]);
  const tool = toolSchema.parse(text);
  return tool;
}
