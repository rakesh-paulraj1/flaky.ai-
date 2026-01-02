import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PlanSchema, PlanType } from "./responsestructures";
import { AgentState } from "./state";
import { createToolsWithContext } from "./tools";
import { Prompts } from "./prompt";
import { getGeminiModel } from "./model";
import prisma from "@/lib/prisma";
import { format_content } from "./dataformation";
import { createAgent } from "langchain";
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

    console.log(`Plannernode Received Prompt ${enhancedPrompt}`);
    console.log(`Plannernode Project ID: ${projectId}`);

    let previousContext = "";

    if (projectId) {
      console.log(`Loading context for project: ${projectId}`);
      const context = await loadProjectContext(projectId);

      if (context) {
        console.log(`Context keys found: ${Object.keys(context)}`);

        let conversationHistoryText = "";
        const conversationHistory = (context.conversation_history as Array<Record<string, unknown>>) || [];
        console.log(`Conversation history entries: ${conversationHistory.length}`);

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
    You are an expert React application architect. Analyze the following user request and create a comprehensive implementation plan.
    ${previousContext}

    USER REQUEST:
    ${enhancedPrompt}

    Create a detailed plan that includes:
    1. Application overview and purpose
    2. Component hierarchy and structure
    3. Page/routing structure
    4. Required dependencies
    5. File structure
    6. Implementation steps

    ${previousContext ? "NOTE: Since this is an existing project, focus your plan on the NEW features/changes requested, not recreating everything." : ""}

    Respond with a JSON object containing the plan.
    `;

    const messages = [
      new SystemMessage(
        "You are an expert React application architect. Create detailed implementation plans."
      ),
      new HumanMessage(planningPrompt),
    ];

    await safeSendEvent(sendEvent, {
      e: "thinking",
      message: "Analyzing your request and creating implementation plan...",
    });

    const structuredModel = model.withStructuredOutput(PlanSchema);
    
    let plan: PlanType;
    let thinkingContent = "";
    
    try {
      const thinkingMessages = [
        new SystemMessage(
          "You are an expert React application architect. Think through the implementation plan step by step."
        ),
        new HumanMessage(`Think through how you would implement this request:\n${planningPrompt}\n\nProvide your reasoning.`),
      ];
      
      let lastSentLength = 0;
      const CHUNK_SIZE = 100;
      
      try {
        const stream = await model.stream(thinkingMessages);
        
        for await (const chunk of stream) {
          const chunkContent = typeof chunk.content === "string" 
            ? chunk.content 
            : Array.isArray(chunk.content) 
              ? chunk.content.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text || "")).join("")
              : "";
          
          thinkingContent += chunkContent;
          
          if (thinkingContent.length - lastSentLength >= CHUNK_SIZE) {
            await safeSendEvent(sendEvent, {
              e: "thinking",
              message: thinkingContent.slice(lastSentLength, thinkingContent.length),
            });
            lastSentLength = thinkingContent.length;
          }
        }
        
        if (thinkingContent.length > lastSentLength) {
          await safeSendEvent(sendEvent, {
            e: "thinking",
            message: thinkingContent.slice(lastSentLength),
          });
        }
      } catch (streamError) {
        console.error("Thinking stream failed:", streamError);
        await safeSendEvent(sendEvent, {
          e: "thinking",
          message: "Generating implementation plan...",
        });
      }
            await safeSendEvent(sendEvent, {
        e: "thinking",
        message: "\n\nGenerating structured plan...",
      });
      
      plan = await structuredModel.invoke(messages);
      
      console.log("Structured plan generated:", JSON.stringify(plan, null, 2));
      
    } catch (structuredError) {
      console.error("Structured output failed, falling back to manual parsing:", structuredError);
      
    
      const response = await model.invoke(messages);
      const content = typeof response.content === "string" 
        ? response.content 
        : JSON.stringify(response.content);
      
      thinkingContent = content;
      
      await safeSendEvent(sendEvent, {
        e: "thinking",
        message: content.slice(0, 500),
      });
      
      
      try {
        
        const parsed =format_content(content);
      
        plan = {
          overview: parsed.overview || content.slice(0, 500),
          components: parsed.components || [],
          pages: parsed.pages || [],
          dependencies: parsed.dependencies || [],
          file_structure: parsed.file_structure || [],
          implementation_steps: parsed.implementation_steps || [],
        };
      } catch {
        
        plan = {
          overview: content,
          components: [],
          pages: [],
          dependencies: [],
          file_structure: [],
          implementation_steps: [],
        };
      }
    }
    try {
      await prisma.message.create({
        data: {
          chatId: projectId,
          role: "assistant",
          content: thinkingContent.slice(0, 2000),
          eventType: "thinking",
        },
      });
    } catch (dbError) {
      console.error("Failed to store thinking message:", dbError);
    }

    try {
      await prisma.message.create({
        data: {
          chatId: projectId,
          role: "assistant",
          content: JSON.stringify(plan, null, 2),
          eventType: "plan",
        },
      });
    } catch (dbError) {
      console.error("Failed to store plan message:", dbError);
    }

    await safeSendEvent(sendEvent, {
      e: "planner_complete",
      plan,
      message: "Planning completed successfully",
    });

    return {
      plan,
      current_node: "planner",
      execution_log: [{ node: "planner", status: "completed", plan }],
    };
  } catch (e) {
    const errorMsg = `Planner node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);

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
// Builder node

export async function builderNode(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    const sandbox = state.sandbox;

    if (!sandbox) {
      throw new Error("Sandbox not available");
    }
    await safeSendEvent(sendEvent, {
      e: "builder_started",
      message: "Starting to build the application...",
    });

    const plan = state.plan || {};
    const currentErrors = state.current_errors || {};
    const projectId = state.project_id || "";

    const baseTools = createToolsWithContext(sandbox, sendEvent, projectId);

    let builderPrompt: string;

    if (Object.keys(currentErrors).length > 0) {
      const errorDetails: string[] = [];
      for (const [errorType, errors] of Object.entries(currentErrors)) {
        if (Array.isArray(errors)) {
          for (const err of errors) {
            if (typeof err === "object" && err !== null) {
              const errorMsg = (err as Record<string, unknown>).error || String(err);
              errorDetails.push(`ERROR: ${errorMsg}`);
            } else {
              errorDetails.push(`ERROR: ${String(err)}`);
            }
          }
        } else {
          errorDetails.push(`${errorType}: ${String(errors)}`);
        }
      }

      builderPrompt = `
      CRITICAL: BUILD FAILED - YOU MUST FIX THESE ERRORS
      
      The previous build attempt failed with these errors:
      
      ${errorDetails.join("\n")}
      
      YOUR TASK:
      1. Read the error messages carefully
      2. Identify which files have syntax errors
      3. Read those files using read_file
      4. Fix the syntax errors (escape sequences, missing imports, etc.)
      5. Use create_file to save the corrected files
      
      COMMON FIXES:
      - If you see "Expecting Unicode escape sequence" → Fix \\n in strings
      - If you see "Cannot find module" → Check import paths
      - If you see "Unexpected token" → Fix JSX syntax errors
      
      Fix ALL errors before finishing!
      `;
    } else {
      // Normal building mode
      builderPrompt = `
      STEP 0: CHECK PREVIOUS WORK (IMPORTANT!)

      FIRST ACTION: Call get_context() to see if there's any previous work on this project.
      - If context exists, read it carefully to understand what's already built
      - Check which files already exist before creating new ones
      - Build upon existing work instead of recreating everything
      
      IMPLEMENTATION PLAN FROM PLANNER:

      ${JSON.stringify(plan, null, 2)}
      
      YOUR MISSION:

      Build the COMPLETE application according to the plan above.
      
      CRITICAL STEPS - DO ALL OF THESE:
      
      1. READ EXISTING FILES FIRST:
         - read_file("package.json") to see dependencies
         - read_file("src/App.jsx") to see current structure
         - read_file("src/main.jsx") to see entry point
         - use tool list_directory to see the directory and try to get context of all file you need by reading them
      
      2. CREATE ALL DIRECTORIES (only create those directory if not there):
         - Use execute_command("mkdir -p ...") for all needed directories
         - Example: mkdir -p src/components/card src/components/navigation src/pages
      
      3. CREATE ALL COMPONENTS, PAGES AND FILES:
         - Use create_file for EVERY component, pages mentioned in the plan
         - Create components and pages ONE BY ONE
         - Follow the component, pages hierarchy in the plan
         - Make sure each component and pages has proper imports and exports
      
      4. UPDATE MAIN FILES:
         - Update src/App.jsx to use the new pages
         - make sure index.css file have this import "@import "tailwindcss";" on top otherwise tailwind not work
         - Update src/App.css with Tailwind directives if needed
      
      5. VERIFY YOUR WORK:
         - Use list_directory to see what you created
         - Make sure ALL components, pages from the plan are created
         - if you need to make extra component and pages, do create them if neeeded
      
      6. SAVE YOUR WORK (FINAL STEP):
         - After completing all files, call save_context() to document what you built
         - Include: what the project is, how it works, and what you created
         - This helps future sessions understand the project
      
      DO NOT STOP until you have created ALL files mentioned in the implementation plan!
      `;
    }

    const messages = [
      new SystemMessage(Prompts),
      new HumanMessage(builderPrompt),
    ];

 const agent = createAgent({
model:model,
tools:baseTools
 })
 const filesCreated: string[] = [];
 const filesModified: string[] = [];

    try {
      console.log(`Builder node: Starting agent execution with ${baseTools.length} tools`);

for await (const chunk of await agent.stream(
  {messages:[{role:"user",content:builderPrompt}]},
{streamMode:"updates"}
))
{
const [step, content] = Object.entries(chunk)[0];
        
        console.log(`Step: ${step}`);
        console.log(`Content: ${JSON.stringify(content, null, 2)}`);

        if (step === "agent" && content && typeof content === "object") {
          const agentContent = content as Record<string, unknown>;
          
          if ("messages" in agentContent && Array.isArray(agentContent.messages)) {
            for (const msg of agentContent.messages) {
              const message = msg as Record<string, unknown>;
              const msgContent = message.content;
              
              let text = "";
              if (typeof msgContent === "string") {
                text = msgContent;
              } else if (Array.isArray(msgContent)) {
                text = msgContent
                  .map((c) => (typeof c === "string" ? c : (c as Record<string, unknown>).text || ""))
                  .join("\n");
              }
              
              if (text && message.role === "assistant") {
                await safeSendEvent(sendEvent, {
                  e: "thinking",
                  message: text,
                });
              }
            }
          }
        } else if (step === "tools" && content && typeof content === "object") {
          const toolsContent = content as Record<string, unknown>;
          if ("messages" in toolsContent && Array.isArray(toolsContent.messages)) {
            for (const msg of toolsContent.messages) {
              const toolMessage = msg as Record<string, unknown>;
              
              if (toolMessage.type === "tool") {
                const toolName = String(toolMessage.name || "unknown");
                const toolOutput = String(toolMessage.content || "");
                
                await safeSendEvent(sendEvent, {
                  e: "tool_completed",
                  tool_name: toolName,
                  tool_output: `The Tool ${toolName} executed in Agent`,
                });
                //imporve
                const outputStr = toolOutput.toLowerCase();
                if (outputStr.includes("created") && outputStr.includes("file")) {
                  const fileMatches = toolOutput.match(/(\w+\.(jsx?|tsx?|css|json))/g);
                  if (fileMatches) {
                    filesCreated.push(...fileMatches);
                  }
                }
              } else if (toolMessage.role === "assistant" && "tool_calls" in toolMessage) {
                // Tool invocation
                const toolCalls = toolMessage.tool_calls as Array<Record<string, unknown>>;
                for (const call of toolCalls) {
                  await safeSendEvent(sendEvent, {
                    e: "tool_started",
                    tool_name: String(call.name || "unknown"),
                    tool_input: call.args || {},
                  });
                }
              }
            }
          }
        }
      }

      console.log("Builder node: Agent execution completed");
      console.log(`Builder node: Final files_created: ${filesCreated}`);

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
        execution_log: [
          {
            node: "builder",
            status: "completed",
            files_created: filesCreated,
            files_modified: filesModified,
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

      console.error(`Builder agent execution error: ${e}`);

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

export async function codeValidatorNode(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    const sandbox = state.sandbox;

    if (!sandbox) {
      throw new Error("Sandbox not available");
    }

    await safeSendEvent(sendEvent, {
      e: "code_validator_started",
      message: "Code validator agent reviewing and fixing code...",
    });

    const projectId = state.project_id || "";
    const baseTools = createToolsWithContext(sandbox, sendEvent, projectId);

    const validatorPrompt = `
    You are a Code Validator Agent - an expert at reviewing and fixing React code.
    
    YOUR MISSION:
    1. Review ALL files in the src/ directory
    2. Check for syntax errors, missing imports, and code issues
    3. Fix any problems you find
    4. Ensure all dependencies are properly installed
    
    STEP-BY-STEP PROCESS:
    
    STEP 1: CHECK DEPENDENCIES FIRST
    - Use check_missing_packages() tool to automatically scan all files and find missing packages
    - This tool will tell you exactly which packages are missing and give you install commands
    - Run the install commands it provides using execute_command()
    
    STEP 2: LIST ALL FILES
    - Use execute_command("find src -name '*.jsx' -o -name '*.js'") to list all files
    
    STEP 3: READ AND REVIEW EACH FILE
    - Use read_file to read each .jsx and .js file
    - Check for:
      * Syntax errors (missing brackets, quotes, semicolons)
      * Escape sequence issues (\\n in strings should be proper)
      * Missing imports (components used but not imported)
      * Incorrect import paths
      * Missing export statements
      * Indentation issues
      * Incomplete components
      * Missing dependencies (like react-icons, react-router-dom)
    
    STEP 4: FIX ISSUES IMMEDIATELY
    - If you find ANY issue, use create_file to fix it RIGHT AWAY
    - Fix one file at a time
    - Make sure imports match the actual file structure
    - Install missing packages with execute_command("npm install package-name")
    
    STEP 5: VALIDATE IMPORTS AND FILE EXISTENCE
    - For each import statement, verify the imported file exists
    - Use execute_command("ls -la src/components/") to check files exist
    - Fix any import paths that are wrong
    
    STEP 6: CHECK FOR COMPLETENESS
    - Make sure App.jsx has proper routing setup
    - Verify all components are properly exported
    - Check that main.jsx imports App correctly
    
    STEP 7: CODE REVIEW COMPLETE
    - You have completed the code review and dependency checking
    - No build test needed - focus on code quality and dependencies only
    
    COMMON MISSING PACKAGES TO CHECK:
    - react-icons (for icons like FaShoppingCart, FaUser, FaTrash, etc.)
    - react-router-dom (for routing)
    - Any other packages imported in the code
    
    CRITICAL: If you see errors like "Failed to resolve import 'react-icons/fa'", 
    it means react-icons is missing. ALWAYS run check_missing_packages() FIRST!
    
    CRITICAL RULES:
    - Fix issues as you find them, don't just report them
    - Use create_file to save corrected code
    - Install missing packages immediately
    - Be thorough - check EVERY file
    - Focus on code quality and dependencies, no build testing needed
    
    SPECIFIC ERROR HANDLING:
    - If you see "Failed to resolve import 'react-icons/fa'" → Install react-icons
    - If you see "Cannot find module" → Check if package is installed
    - If you see "Module not found" → Install the missing package
    - If you see "Failed to resolve import '../../features/products/productsSlice'" → Check if productsSlice.js exists, recreate if missing
    - If you see "Does the file exist?" → The file is missing, recreate it using create_file
    
    START NOW: First run check_missing_packages() to find missing packages, then install them and review files
    `;

    const messages = [
      new SystemMessage(
        "You are a Code Validator Agent. Review and fix all code issues."
      ),
      new HumanMessage(validatorPrompt),
    ];
    
const agent = createAgent({
      model: model,
      tools: baseTools
    });

    try {
      console.log(`Code validator: Starting agent execution with ${baseTools.length} tools`);

      const validationErrors: Array<Record<string, unknown>> = [];

      for await (const chunk of await agent.stream(
        { messages: messages },
        { streamMode: "updates" }
      )) {
        const entry = Object.entries(chunk)[0];
        if (!entry) continue;
        const [step, content] = entry;

    if (step === "agent" && content && typeof content === "object") {
          const agentContent = content as Record<string, unknown>;
          
          if ("messages" in agentContent && Array.isArray(agentContent.messages)) {
            for (const msg of agentContent.messages) {
              const msgContent = (msg as Record<string, unknown>).content;
              let text = "";
              
              if (typeof msgContent === "string") {
                text = msgContent;
              } else if (Array.isArray(msgContent)) {
                text = msgContent
                  .map((c) => (typeof c === "string" ? c : (c as Record<string, unknown>).text || ""))
                  .join("\n");
              }
              
              if (text) {
                await safeSendEvent(sendEvent, { e: "thinking", message: text });
              }
            }
          }
        } else if (step === "tools" && content && typeof content === "object") {
          const toolsContent = content as Record<string, unknown>;
          
          if ("messages" in toolsContent && Array.isArray(toolsContent.messages)) {
            for (const msg of toolsContent.messages) {
              const toolMessage = msg as Record<string, unknown>;
              
              if (toolMessage.type === "tool") {
                // Tool result
                const toolName = String(toolMessage.name || "unknown");
                const toolOutput = String(toolMessage.content || "");
                
                await safeSendEvent(sendEvent, {
                  e: "tool_completed",
                  tool_name: toolName,
                  tool_output: toolOutput,
                });
              } else if (toolMessage.role === "assistant" && "tool_calls" in toolMessage) {
                const toolCalls = toolMessage.tool_calls as Array<Record<string, unknown>>;
                for (const call of toolCalls) {
                  await safeSendEvent(sendEvent, {
                    e: "tool_started",
                    tool_name: String(call.name || "unknown"),
                    tool_input: call.args || {},
                  });
                }
              }
            }
          }
        }
      }

      console.log("Code validator: Agent execution completed");
      console.log("Code validator: Code review and dependency checking completed");

      await safeSendEvent(sendEvent, {
        e: "validation_success",
        message: "Code validator completed - code review and dependencies checked!",
      });

      const retryCount = { ...state.retry_count };
      let newCurrentErrors = {};

      if (validationErrors.length > 0) {
        retryCount.validation_errors = (retryCount.validation_errors || 0) + 1;
        newCurrentErrors = { validation_errors: validationErrors };
        console.log(`Code validator: Found ${validationErrors.length} validation errors`);
      } else {
        console.log("Code validator: No validation errors found");
      }

      await safeSendEvent(sendEvent, {
        e: "code_validator_complete",
        errors: validationErrors,
        message: `Code validation completed. Found ${validationErrors.length} errors.`,
      });

      return {
        validation_errors: validationErrors,
        current_node: "code_validator",
        retry_count: retryCount,
        current_errors: newCurrentErrors,
        execution_log: [
          {
            node: "code_validator",
            status: "completed",
            validation_errors: validationErrors,
          },
        ],
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("timeout")) {
        console.log("Code validator agent timed out after 10 minutes");

        await safeSendEvent(sendEvent, {
          e: "code_validator_timeout",
          message: "Code validator timed out",
        });

        return {
          validation_errors: [
            {
              type: "timeout",
              error: "Code validator timed out",
              details: "Validation took too long",
            },
          ],
          current_node: "code_validator",
          execution_log: [
            {
              node: "code_validator",
              status: "timeout",
            },
          ],
        };
      }

      throw e;
    }
  } catch (e) {
    const errorMsg = `Code validator node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);

    await safeSendEvent(sendEvent, {
      e: "code_validator_error",
      message: errorMsg,
    });

    return {
      current_node: "code_validator",
      error_message: errorMsg,
      validation_errors: [
        {
          type: "validator_error",
          error: e instanceof Error ? e.message : String(e),
          details: "Code validator crashed",
        },
      ],
      execution_log: [{ node: "code_validator", status: "error", error: errorMsg }],
    };
  }
}


export async function applicationCheckerNode(
  state: typeof AgentState.State,
  sendEvent: EventSender | null
): Promise<Partial<typeof AgentState.State>> {
  try {
    const sandbox = state.sandbox;

    if (!sandbox) {
      throw new Error("Sandbox not available");
    }

    await safeSendEvent(sendEvent, {
      e: "app_check_started",
      message: "Checking application status and capturing errors...",
    });

    const runtimeErrors: Array<Record<string, unknown>> = [];

    console.log(
      "Application checker: Skipping dev server checks - environment is pre-configured"
    );

    try {
      const mainFiles = ["src/App.jsx", "src/main.jsx", "package.json"];
      const missingFiles: string[] = [];

      for (const filePath of mainFiles) {
        try {
          await sandbox.files.read(`/home/user/react-app/${filePath}`);
        } catch {
          missingFiles.push(filePath);
        }
      }

      if (missingFiles.length > 0) {
        runtimeErrors.push({
          type: "missing_files",
          error: `Missing essential files: ${missingFiles.join(", ")}`,
        });
      } else {
        console.log("Application checker: All essential files present");
      }
    } catch (e) {
      runtimeErrors.push({
        type: "file_check_failed",
        error: `Failed to check application files: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    const retryCount = { ...state.retry_count };
    let newCurrentErrors = {};
    let success = false;

    if (runtimeErrors.length > 0) {
      retryCount.runtime_errors = (retryCount.runtime_errors || 0) + 1;
      newCurrentErrors = { runtime_errors: runtimeErrors };
    } else {
      success = true;
      console.log(
        "Application checker: No runtime errors found - setting success to True"
      );
    }

    await safeSendEvent(sendEvent, {
      e: "app_check_complete",
      errors: runtimeErrors,
      message: `Application check completed. Found ${runtimeErrors.length} runtime errors.`,
    });

    return {
      runtime_errors: runtimeErrors,
      current_node: "application_checker",
      retry_count: retryCount,
      current_errors: newCurrentErrors,
      success,
      execution_log: [
        {
          node: "application_checker",
          status: "completed",
          runtime_errors: runtimeErrors,
        },
      ],
    };
  } catch (e) {
    const errorMsg = `Application checker node error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);

    await safeSendEvent(sendEvent, {
      e: "app_check_error",
      message: errorMsg,
    });

    return {
      current_node: "application_checker",
      error_message: errorMsg,
      execution_log: [
        { node: "application_checker", status: "error", error: errorMsg },
      ],
    };
  }
}

export function shouldRetryBuilderForValidation(
  state: typeof AgentState.State
): "builder" | "application_checker" {
  const validationErrors = state.validation_errors || [];
  const retryCount = state.retry_count || {};
  const maxRetries = state.max_retries || 3;

  const totalRetries = Object.values(retryCount).reduce((sum, count) => sum + count, 0);
  if (totalRetries > 10) {
    console.log(
      `Maximum total retries reached (${totalRetries}) - continuing to application checker`
    );
    return "application_checker";
  }

  console.log(
    `Code validator decision: ${validationErrors.length} errors, ${retryCount.validation_errors || 0} retries`
  );

  if (validationErrors.length === 0) {
    console.log("No validation errors - continuing to application checker");
    return "application_checker";
  }

  const currentRetries = retryCount.validation_errors || 0;
  if (currentRetries < maxRetries) {
    console.log(
      `Retrying builder for validation errors (attempt ${currentRetries + 1}/${maxRetries})`
    );
    return "builder";
  } else {
    console.log(
      `Max retries reached for validation errors - continuing to application checker`
    );
    return "application_checker";
  }
}

export function shouldRetryBuilderOrFinish(
  state: typeof AgentState.State
): "builder" | "end" {
  const runtimeErrors = state.runtime_errors || [];
  const retryCount = state.retry_count || {};
  const maxRetries = state.max_retries || 3;

  const totalRetries = Object.values(retryCount).reduce((sum, count) => sum + count, 0);
  if (totalRetries > 10) {
    console.log(`Maximum total retries reached (${totalRetries}) - forcing end`);
    return "end";
  }

  console.log(
    `Application checker decision: ${runtimeErrors.length} errors, ${retryCount.runtime_errors || 0} retries`
  );

  if (runtimeErrors.length === 0) {
    console.log("No runtime errors - finishing successfully");
    return "end";
  }

  const currentRetries = retryCount.runtime_errors || 0;
  if (currentRetries < maxRetries) {
    console.log(
      `Retrying builder for runtime errors (attempt ${currentRetries + 1}/${maxRetries})`
    );
    return "builder";
  } else {
    console.log(`Max retries reached for runtime errors - finishing with errors`);
    return "end";
  }
}
