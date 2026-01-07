import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { createToolsWithContext } from "./tools";
import { getGeminiModel } from "./model";
import prisma from "@/lib/prisma";
import { createAgent } from "langchain";
import { Prompts } from "./prompt";
type EventSender = (payload: Record<string, unknown>) => void;

const model = getGeminiModel();


async function safeSendEvent(
  sendEvent: EventSender | null,
  data: Record<string, unknown>
): Promise<void> {
  if (!sendEvent) return;
  try {
    sendEvent(data);
  } catch (e) {
    console.error("safeSendEvent failed:", e);
  }
}

async function loadProjectContext(
  projectId: string
): Promise<Record<string, unknown> | null> {
  console.log(`Loading context for project: ${projectId}`);

  try {
    const chat = await prisma.chat.findUnique({
      where: { id: projectId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
    });

    if (!chat) {
      console.log(`No chat found for project: ${projectId}`);
      return null;
    }

    const hasAssistantMessages = chat.messages.some(
      (msg) => msg.role === "assistant"
    );

    if (!hasAssistantMessages) {
      console.log(`No assistant messages found - treating as new project`);
      return null;
    }

    const conversationHistory = chat.messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        user_prompt: msg.role === "user" ? msg.content : undefined,
        success: msg.role === "assistant" && !msg.content.toLowerCase().includes("error"),
        createdAt: msg.createdAt,
      }));

    const contextMessage = chat.messages.find(
      (msg) => msg.eventType === "context_saved"
    );

    let semantic = "";
    let procedural = "";
    let episodic = "";
    let filesCreated: string[] = [];

    if (contextMessage) {
      try {
        const savedContext = JSON.parse(contextMessage.content);
        semantic = savedContext.semantic || "";
        procedural = savedContext.procedural || "";
        episodic = savedContext.episodic || "";
        filesCreated = savedContext.files_created || [];
      } catch {
        semantic = contextMessage.content;
      }
    }

    const fileMessages = chat.messages.filter(
      (msg) => msg.eventType === "file_created" || msg.eventType === "files_created"
    );
    for (const msg of fileMessages) {
      const fileMatch = msg.content.match(/Created\s+([\w/.]+)/g);
      if (fileMatch) {
        filesCreated.push(...fileMatch.map((m) => m.replace("Created ", "")));
      }
    }

    const hasContext = semantic || procedural || episodic || filesCreated.length > 0;
    if (!hasContext) {
      console.log(`No meaningful context found - treating as new project`);
      return null;
    }

    return {
      semantic,
      procedural,
      episodic,
      files_created: [...new Set(filesCreated)],
      conversation_history: conversationHistory,
      chat_title: chat.title,
    };
  } catch (error) {
    console.error(`Error loading context for project ${projectId}:`, error);
    return null;
  }
}

export async function plannerNode(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    await safeSendEvent(sendEvent, {
      e: "planner_started",
      message: "Planning the application architecture...",
    });

    const enhancedPrompt = state.enhanced_prompt || state.user_prompt || "";
    const projectId = state.project_id || "";

    let previousContext = "";

    if (projectId) {
      const context = await loadProjectContext(projectId);

      if (context) {
        let conversationHistoryText = "";
        const conversationHistory = (context.conversation_history as Array<Record<string, unknown>>) || [];

        if (conversationHistory.length > 0) {
          conversationHistoryText = "\nCONVERSATION HISTORY (Last requests):\n";
        const recentHistory = conversationHistory.slice(-5);
          recentHistory.forEach((conv, i) => {
            const status = conv.success ? "[SUCCESS]" : "[FAILED]";
            const prompt = String(conv.user_prompt || "Unknown").slice(0, 100);
            conversationHistoryText += `   ${i + 1}. ${status} ${prompt}\n`;
          });
        }


        previousContext = `

        IMPORTANT: PREVIOUS WORK ON THIS PROJECT
        
        WHAT THIS PROJECT IS:
        ${context.semantic || "Not documented"}
        
        HOW IT WORKS:
        ${context.procedural || "Not documented"}
        
        WHAT HAS BEEN DONE:
        ${context.episodic || "Not documented"}
        
        EXISTING FILES: ${((context.files_created as string[]) || []).length} files already exist
        ${conversationHistoryText}
        
        CRITICAL: This is an EXISTING project. Your plan should:
        - Build upon what already exists
        - Consider the conversation history to understand the user's intent
        - Only add/modify what's needed for the new request
        - NOT recreate existing components/pages
        - Integrate with the existing structure
        `;
        console.log("Previous context prepared successfully");
      } else {
        console.log("No previous context found - empty dict returned");
      }
    }

    const planningPrompt = `
    You are an expert React application architect. Create a simple, clear implementation plan for a SINGLE-PAGE application.

    USER REQUEST:
    ${enhancedPrompt}

    ${previousContext}

    IMPORTANT: This is a SINGLE-PAGE application. All functionality goes in src/pages/Home.jsx with reusable components in src/components/.

    ${previousContext ? "NOTE: This is an existing project. Focus on the NEW features/changes requested." : ""}

    Provide a concise text explanation covering:
    - What the application will do
    - What components need to be created in src/components/
    - How Home.jsx will be structured
    - Any new dependencies needed (don't list: react, react-dom, react-router-dom, react-icons, tailwindcss)
    - Step-by-step implementation approach

    Write your response as clear, natural text (not JSON). Be specific and actionable.
    `;

    const messages = [
      new SystemMessage(
        "You are an expert React application architect. Create detailed implementation plans."
      ),
      new HumanMessage(planningPrompt),
    ];

    await safeSendEvent(sendEvent, {
      e: "generating_plan",
      message: "Generating implementation plan...",
    });

    let planText = "";

    try {
      const response = await model.invoke(messages);
      planText = typeof response.content === "string" 
        ? response.content 
        : String(response.content || "");
    } catch (error) {
      console.error("Plan generation failed:", error);
      planText = "Failed to generate implementation plan. Please try again with a clearer request.";
    }

  
    

 const formattedPlan = ` **IMPLEMENTATION PLAN**

${planText}
`;
  if (projectId) {
      try {
        await prisma.message.create({
          data: {
            chatId: projectId,
            role: "assistant",
            content: formattedPlan,
            eventType: "plan",
          },
        });
      } catch (dbError) {
        console.error("Failed to store plan message:", dbError);
      }
    }

    await safeSendEvent(sendEvent, {
      e: "planner_complete",
      message: `Planning completed successfully + ${formattedPlan}`,
    });

    return {
      plan: planText,
      current_node: "planner",
      execution_log: [{ node: "planner", status: "completed", plan: planText }],
    };
  } catch (e) {
    const errorMsg = `Planner node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg, e);

    await safeSendEvent(sendEvent, {
      e: "planner_error",
      message: errorMsg,
    });

    return {
      current_node: "planner",
      error_message: errorMsg,
      execution_log: [{ node: "planner", status: "error", error: errorMsg }],
    };
  }
}


export async function builderNode(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    const sandbox = state.sandbox;
    if (!sandbox) {
      throw new Error("Sandbox not available");
    }
    
    const retryCount = state.retry_count ?? 0;
    const validationIssues = state.validation_issues || [];
    const isRetry = retryCount > 0;

    await safeSendEvent(sendEvent, {
      e: "builder_started",
      message: isRetry 
        ? `\n\nRetrying build (attempt ${retryCount + 1})...`
        : "\n\nStarting to build the application...",
      retry_count: retryCount,
    });

    const plan = state.plan || "";
  
    const baseTools = createToolsWithContext(sandbox);

    let validationContext = "";
    if (isRetry && validationIssues.length > 0) {
      validationContext = `\n\n⚠️ CRITICAL: PREVIOUS BUILD HAD VALIDATION ISSUES ⚠️
The previous Home.jsx had these problems that MUST be fixed:

${validationIssues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

YOU MUST FIX ALL THESE ISSUES in this build!
`;
    }

  const  builderPrompt = `You have been provided with an implementation plan below.
Read and understand the plan carefully before starting.

IMPLEMENTATION PLAN:
${plan}

${validationContext}

YOUR MISSION:
Build the COMPLETE single-page application in Home.jsx according to the plan above.

CRITICAL: SINGLE FILE APPROACH
- You can ONLY write to Home.jsx (located at /home/user/react-app/pages/Home.jsx)
- ALL functionality, state, and UI must go in this ONE file
- DO NOT try to create separate component files - they won't work
- Put helper functions inside the Home component if needed
- Use inline components or component functions within Home.jsx
- Do not use any 3rd paackages no usage of icons is allowed from 3rd party packages
AVAILABLE TOOLS:
1. read_file() - Read the current content of Home.jsx
2. create_file(content) - Write the complete Home.jsx content

STEP-BY-STEP PROCESS (DO EXACTLY THESE STEPS, THEN STOP):
1. Call read_file() ONCE to see current Home.jsx content
2. Analyze what needs to be added/changed based on the plan
3. Call create_file(content) ONCE with the COMPLETE new Home.jsx
4. IMMEDIATELY STOP - Do NOT call any more tools!

 CRITICAL STOPPING RULE
After create_file() returns "Home.jsx updated successfully" → YOU MUST STOP IMMEDIATELY
Do NOT:
- Verify by reading the file again
- Call create_file() multiple times
- Make any additional tool calls
- Try to "improve" or "fix" anything

Once create_file() succeeds → YOUR TASK IS COMPLETE → RETURN IMMEDIATELY

IMPLEMENTATION GUIDELINES:
- Include ALL imports at the top (React, hooks, icons, etc.)
- Define helper functions inside the component
- Use React hooks for state management (useState, useEffect, etc.)
- Write clean, self-contained code
- Include proper styling with Tailwind classes
- Make it responsive and user-friendly

CRITICAL RULES:
- Write the COMPLETE file content - NO placeholders like "...existing code..."
- Include ALL features from the plan in one cohesive Home.jsx
- Maximum 2 tool calls: read_file() once, create_file() once
- After create_file() succeeds → DONE → NO MORE ACTIONS

START NOW: Read → Write → STOP IMMEDIATELY!`;

    const messages = [
      new SystemMessage(Prompts),
      new HumanMessage(builderPrompt),
    ];

    const agent = createAgent({
      model: model,
      tools: baseTools,
    });
    
    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    try {
      console.log(`Builder node: Starting agent execution with ${baseTools.length} tools`);

      const toolCallCount = 0;
      let hasWritten = false;
      let fileCreatedSuccessfully = false;
      
      try {
        const stream = await agent.stream(
          { messages: messages },
          {
            streamMode: "updates",
          }
        );
        
        for await (const chunk of stream) {
          if (chunk && chunk.tools) {
            console.log("Tool streaming response "+ chunk)
            const toolsChunk = chunk.tools as Record<string, unknown>;
            if (toolsChunk.messages) {
              const messages = toolsChunk.messages as Array<Record<string, unknown>>;
              for (const msg of messages) {
                const content = String(msg.content || "");
                const toolName = String(msg.name || "unknown_tool");
                
                await safeSendEvent(sendEvent, {
                  e: "tool_response",
                  tool: toolName,
                  content: `Tool ${toolName} returned: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
                });
                
                if (content.includes("Home.jsx updated successfully")) {
                  fileCreatedSuccessfully = true;
                  console.log("Builder: File created successfully - STOPPING IMMEDIATELY");
                  
                  await safeSendEvent(sendEvent, {
                    e: "file_created",
                    file: "Home.jsx",
                    message: "Home.jsx created/updated successfully",
                  });
                  
                  break;
                }
              }
            }
          }
                    if (fileCreatedSuccessfully) {
            console.log("Builder: Breaking out of stream - file creation complete");
            break;
          }
          
          
          if (chunk) {
            console.log(`Chunk: ${Object.keys(chunk).join(", ")}`);
          }
        }
        
        console.log(`Builder done: ${toolCallCount} tools, written: ${hasWritten}, success: ${fileCreatedSuccessfully}`);
        
        if (fileCreatedSuccessfully) {
          hasWritten = true;
        }
      } catch (streamError) {
        console.error("Stream error:", streamError);
      }

      await safeSendEvent(sendEvent, {
        e: "builder_complete",
        files_created: filesCreated,
        files_modified: filesModified,
        message: "Building completed",
      });

      return {
        files_created: filesCreated,
        files_modified: filesModified,
        current_node: "builder",
        success: true,
        retry_count: retryCount + 1,
        execution_log: [
          {
            node: "builder",
            status: "completed",
            files_created: filesCreated,
            files_modified: filesModified,
            retry_count: retryCount + 1,
          },
        ],
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("timeout")) {
        console.log("Builder agent timed out after 10 minutes");

        await safeSendEvent(sendEvent, {
          e: "builder_error",
          message: "Builder agent timed out after 10 minutes",
        });

        return {
          files_created: [],
          files_modified: [],
          current_node: "builder",
          execution_log: [
            {
              node: "builder",
              status: "timeout",
              files_created: [],
              files_modified: [],
            },
          ],
        };
      }

      console.error(`Builder agent execution error:`, e);

      await safeSendEvent(sendEvent, {
        e: "builder_error",
        message: `Builder agent execution error: ${e instanceof Error ? e.message : String(e)}`,
      });

      return {
        files_created: [],
        files_modified: [],
        current_node: "builder",
        execution_log: [
          {
            node: "builder",
            status: "error",
            files_created: [],
            files_modified: [],
          },
        ],
      };
    }
  } catch (e) {
    const errorMsg = `Builder node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);

    await safeSendEvent(sendEvent, {
      e: "builder_error",
      message: errorMsg,
    });

    return {
      current_node: "builder",
      error_message: errorMsg,
      execution_log: [{ node: "builder", status: "error", error: errorMsg }],
    };
  }
}




export async function Validator(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    const sandbox = state.sandbox;
    if (!sandbox) {
      throw new Error("Sandbox not available");
    }

    await safeSendEvent(sendEvent, {
      e: "validator_started",
      message: "Validating Home.jsx...",
    });

    // Simple file read to check if Home.jsx exists and has content
    try {
      const fileContent = await sandbox.files.read("/home/user/react-app/pages/Home.jsx");
      
      if (!fileContent || fileContent.trim().length === 0) {
        console.log("Validator: Home.jsx is empty or missing");
        
        await safeSendEvent(sendEvent, {
          e: "validator_failed",
          message: "Validation failed: Home.jsx is empty or missing",
        });

        return {
          validation_passed: false,
          validation_issues: ["Home.jsx is empty or missing"],
          current_node: "validator",
          execution_log: [
            {
              node: "validator",
              status: "failed",
              issues: ["Home.jsx is empty or missing"],
            },
          ],
        };
      }

      // Basic validation checks
      const hasReactImport = fileContent.includes("import") && fileContent.includes("React");
      const hasExport = fileContent.includes("export default");
      const hasBasicStructure = fileContent.includes("function") || fileContent.includes("const");

      const validationPassed = hasReactImport && hasExport && hasBasicStructure;
      
      const validationIssues: string[] = [];
      if (!hasReactImport) validationIssues.push("Missing React imports");
      if (!hasExport) validationIssues.push("Missing export default statement");
      if (!hasBasicStructure) validationIssues.push("Missing component function/const declaration");

      console.log(`Validator: ${validationPassed ? "PASSED" : "FAILED"}`, validationIssues);

      await safeSendEvent(sendEvent, {
        e: validationPassed ? "validator_passed" : "validator_failed",
        validation_passed: validationPassed,
        issues: validationIssues,
        message: validationPassed
          ? "Validation passed successfully"
          : `Validation failed: ${validationIssues.join(", ")}`,
      });

      return {
        validation_passed: validationPassed,
        validation_issues: validationIssues,
        current_node: "validator",
        execution_log: [
          {
            node: "validator",
            status: validationPassed ? "passed" : "failed",
            issues: validationIssues,
          },
        ],
      };
    } catch (fileError) {
      console.error("Validator: Failed to read Home.jsx", fileError);
      
      await safeSendEvent(sendEvent, {
        e: "validator_failed",
        message: "Validation failed: Could not read Home.jsx",
      });

      return {
        validation_passed: false,
        validation_issues: ["Could not read Home.jsx file"],
        current_node: "validator",
        execution_log: [
          {
            node: "validator",
            status: "failed",
            issues: ["Could not read Home.jsx file"],
          },
        ],
      };
    }
  } catch (e) {
    const errorMsg = `Validator node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);

    await safeSendEvent(sendEvent, {
      e: "validator_error",
      message: errorMsg,
    });

    return {
      validation_passed: false,
      validation_issues: [errorMsg],
      current_node: "validator",
      error_message: errorMsg,
      execution_log: [{ node: "validator", status: "error", error: errorMsg }],
    };
  }
}

export function shouldContinueNode(
  state: typeof AgentState.State
): "builder" | "executor" {
  const validationPassed = state.validation_passed ?? false;
  const retryCount = state.retry_count ?? 0;
  const maxRetries = state.max_retries ?? 2;

  console.log(
    `shouldContinue: validation=${validationPassed}, retries=${retryCount}/${maxRetries}`
  );

  if (validationPassed) {
    console.log("shouldContinue: Validation passed -> going to executor");
    return "executor";
  }

  if (retryCount >= maxRetries) {
    console.log(
      `shouldContinue: Max retries (${maxRetries}) reached -> going to executor anyway`
    );
    return "executor";
  }

  console.log("shouldContinue: Validation failed -> retrying builder");
  return "builder";
}

export async function executorNode(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    const sandbox = state.sandbox;
    if (!sandbox) {
      throw new Error("Sandbox not available");
    }

    await safeSendEvent(sendEvent, {
      e: "executor_started",
      message: "Starting application execution...",
    });

    const filesCreated = state.files_created || [];
    const hasFiles = filesCreated.length > 0;

    if (hasFiles) {
      console.log("Executor: Starting dev server...");
      try {
        // Kill any existing dev server
        await sandbox.commands.run("pkill -f 'vite'", {
          background: false,
        }).catch(() => {
          console.log("No existing dev server to kill");
        });

        // Start the dev server
        await sandbox.commands.run("cd /home/user/react-app && npm run dev", {
          background: true,
        });
        
        await safeSendEvent(sendEvent, {
          e: "dev_server_started",
          message: "Dev server started successfully",
        });
        
        console.log("Executor: Dev server started successfully");

        await safeSendEvent(sendEvent, {
          e: "executor_complete",
          message: "Application execution completed successfully",
        });

        return {
          current_node: "executor",
          success: true,
          execution_log: [{
            node: "executor",
            status: "completed",
            message: "Dev server started successfully",
          }],
        };
      } catch (devError) {
        console.error("Executor: Failed to start dev server:", devError);
        await safeSendEvent(sendEvent, {
          e: "dev_server_error",
          message: "Failed to start dev server",
        });

        return {
          current_node: "executor",
          success: false,
          error_message: `Failed to start dev server: ${devError instanceof Error ? devError.message : String(devError)}`,
          execution_log: [{
            node: "executor",
            status: "error",
            error: String(devError),
          }],
        };
      }
    } else {
      await safeSendEvent(sendEvent, {
        e: "executor_skipped",
        message: "No files to execute",
      });

      return {
        current_node: "executor",
        success: true,
        execution_log: [{
          node: "executor",
          status: "skipped",
          message: "No files were created",
        }],
      };
    }
  } catch (e) {
    const errorMsg = `Executor node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);

    await safeSendEvent(sendEvent, {
      e: "executor_error",
      message: errorMsg,
    });

    return {
      current_node: "executor",
      error_message: errorMsg,
      execution_log: [{ node: "executor", status: "error", error: errorMsg }],
    };
  }
}
