export interface ToolCall {
  name: string;
  status: "success" | "error" | "running";
  output?: string;
}

export interface ActiveToolCall {
  name: string;
  status: "running" | "completed";
  output?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  formatted?: string;
  event_type?: string;
  tool_calls?: ToolCall[];
  created_at?: string;
}

export interface UserData {
  email: string;
  tokens_remaining: number;
}
