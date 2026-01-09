import { StateGraph, START } from "@langchain/langgraph";
import { Sandbox } from "@e2b/code-interpreter";
import { AgentState } from "./state";
import {
  plannerNode,
  builderNode,
  Validator,
  shouldContinueNode,
  executorNode,
} from "./nodes";
import { sandboxService } from "./services";

type EventSender = (payload: Record<string, unknown>) => void;

export interface ProjectContext {
  productName: string;
  productDescription: string;
  imageLink: string;
}

export interface AgentConfig {
  projectId: string;
  userPrompt: string;
  sendEvent: EventSender | null;
  sandbox?: Sandbox;
  maxRetries?: number;
  projectContext?: ProjectContext;
}

export function createAgentGraph(config: AgentConfig) {
  const { sendEvent } = config;

  const plannerWrapper = async (state: typeof AgentState.State) => {
    return plannerNode(state, sendEvent);
  };

  const builderWrapper = async (state: typeof AgentState.State) => {
    return builderNode(state, sendEvent);
  };

  const validatorWrapper = async (state: typeof AgentState.State) => {
    return Validator(state, sendEvent);
  };

  const executorWrapper = async (state: typeof AgentState.State) => {
    return executorNode(state, sendEvent);
  };

  const workflow = new StateGraph(AgentState)
    .addNode("planner", plannerWrapper)
    .addNode("builder", builderWrapper)
    .addNode("validator", validatorWrapper)
    .addNode("executor", executorWrapper)
    .addEdge(START, "planner")
    .addEdge("planner", "builder")
    .addEdge("builder", "validator")
    .addConditionalEdges("validator", shouldContinueNode, {
      builder: "builder",
      executor: "executor",
    })
    .addEdge("executor", "__end__");

  const app = workflow.compile();

  return app;
}

export async function runAgent(
  config: AgentConfig
): Promise<typeof AgentState.State> {
  const {
    projectId,
    userPrompt,
    sendEvent,
    maxRetries = 1,
    projectContext,
  } = config;

  const sandbox =
    config.sandbox || (await sandboxService.getSandbox(projectId));

  const app = createAgentGraph({ ...config, sandbox });

  const initialState = {
    project_id: projectId,
    user_prompt: userPrompt,
    enhanced_prompt: userPrompt,
    sandbox,
    max_retries: maxRetries,
    product_name: projectContext?.productName || "",
    product_description: projectContext?.productDescription || "",
    image_link: projectContext?.imageLink || "",
  };

  const result = await app.invoke(initialState);

  sendEvent?.({ e: "complete", success: result.success });

  return result;
}
