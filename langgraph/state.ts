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
  product_name: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  product_description: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),
  image_link: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
  }),

  plan: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "",
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

  validation_passed: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  validation_issues: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  retry_count: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  max_retries: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 2,
  }),
});

export type AgentStateType = typeof AgentState.State;
