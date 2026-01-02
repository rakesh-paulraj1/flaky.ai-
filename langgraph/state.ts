import { Annotation } from "@langchain/langgraph";
import type { Sandbox } from "@e2b/code-interpreter";

export const AgentState = Annotation.Root({
 
  project_id: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  user_prompt: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  enhanced_prompt: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),


  plan: Annotation<Record<string, unknown> | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),

  
  files_created: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  files_modified: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  current_errors: Annotation<Record<string, unknown>>({
    reducer: (_, y) => y,
    default: () => ({}),
  }),
  validation_errors: Annotation<Array<Record<string, unknown>>>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  runtime_errors: Annotation<Array<Record<string, unknown>>>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  retry_count: Annotation<Record<string, number>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  max_retries: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 3,
  }),

  sandbox: Annotation<Sandbox | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),

  current_node: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  execution_log: Annotation<Array<Record<string, unknown>>>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  success: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  error_message: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
});

// Export the state type for use in nodes
export type AgentStateType = typeof AgentState.State;