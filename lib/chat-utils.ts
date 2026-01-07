import { Message, ToolCall } from "./chat-types";

export function consolidateMessages(messages: Message[]): Message[] {

  return messages;
}

export function getAllToolCalls(messages: Message[]): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  messages.forEach((msg) => {
    if (msg.tool_calls) {
      toolCalls.push(...msg.tool_calls);
    }
  });
  return toolCalls;
}
