import { StateGraph, START } from "@langchain/langgraph";
import { Sandbox } from "@e2b/code-interpreter";
import { AgentState } from "./state";
import {
  plannerNode,
  builderNode,
  codeValidatorNode,
  applicationCheckerNode,
  shouldRetryBuilderForValidation,
  shouldRetryBuilderOrFinish,
} from "./nodes";
import { sandboxService } from "./services";


type EventSender = (payload: Record<string, unknown>) => void;


export interface AgentConfig {
  projectId: string;
  userPrompt: string;
  sendEvent: EventSender | null;
  sandbox?: Sandbox;
  maxRetries?: number;
}

export function createAgentGraph(config: AgentConfig) {
  const { sendEvent } = config;

  const plannerWrapper = async (state: typeof AgentState.State) => {
    return plannerNode(state, sendEvent);
  };

  const builderWrapper = async (state: typeof AgentState.State) => {
    return builderNode(state, sendEvent);
  };

  const codeValidatorWrapper = async (state: typeof AgentState.State) => {
    return codeValidatorNode(state, sendEvent);
  };

  const applicationCheckerWrapper = async (state: typeof AgentState.State) => {
    return applicationCheckerNode(state, sendEvent);
  };

  const workflow = new StateGraph(AgentState)
    .addNode("planner", plannerWrapper)
    .addNode("builder", builderWrapper)
    .addNode("code_validator", codeValidatorWrapper)
    .addNode("application_checker", applicationCheckerWrapper)
  
    .addEdge(START, "planner")
    .addEdge("planner", "builder")
    .addEdge("builder", "code_validator")
    .addConditionalEdges(
      "code_validator",
      shouldRetryBuilderForValidation,
      ["builder", "application_checker"]
    )
    .addConditionalEdges(
      "application_checker",
      (state) => {
        const result = shouldRetryBuilderOrFinish(state);
        return result === "end" ? "__end__" : result;
      },
      ["builder", "__end__"]
    );

  const app = workflow.compile();

  return app;
}


export async function runAgent(config: AgentConfig): Promise<typeof AgentState.State> {
  const { projectId, userPrompt, sendEvent, maxRetries = 3 } = config;

  const sandbox = config.sandbox || await sandboxService.getSandbox(projectId);

  if (!config.sandbox) {
    sendEvent?.({ e: "sandbox_ready", message: "Sandbox initialized and ready" });
  }

  const app = createAgentGraph({ ...config, sandbox });

  const initialState = {
    project_id: projectId,
    user_prompt: userPrompt,
    enhanced_prompt: userPrompt,
    sandbox,
    max_retries: maxRetries,
  };

  const result = await app.invoke(initialState);

  sendEvent?.({ e: "complete", success: result.success });

  return result;
}


