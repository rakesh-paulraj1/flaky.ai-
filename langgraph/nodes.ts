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

async function imageUrlToBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error("Failed to fetch image:", response.status);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
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
        success:
          msg.role === "assistant" &&
          !msg.content.toLowerCase().includes("error"),
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
      (msg) =>
        msg.eventType === "file_created" || msg.eventType === "files_created"
    );
    for (const msg of fileMessages) {
      const fileMatch = msg.content.match(/Created\s+([\w/.]+)/g);
      if (fileMatch) {
        filesCreated.push(...fileMatch.map((m) => m.replace("Created ", "")));
      }
    }

    const hasContext =
      semantic || procedural || episodic || filesCreated.length > 0;
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
        const conversationHistory =
          (context.conversation_history as Array<Record<string, unknown>>) ||
          [];

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
        
        EXISTING FILES: ${
          ((context.files_created as string[]) || []).length
        } files already exist
        ${conversationHistoryText}
        
        CRITICAL: This is an EXISTING project. Your plan should:
        - Build upon what already exists
        - Consider the conversation history to understand the user's intent
        - Only add/modify what's needed for the new request
        - NOT recreate existing components/pages
        - Integrate with the existing structure
        `;
      } else {
        console.log("No previous context found - empty dict returned");
      }
    }

    const productName = state.product_name || "Product";
    const productDescription = state.product_description || "";
    const imageLink = state.image_link || "";

    const planningPrompt = `
You are an expert React developer specializing in high-converting product campaign landing pages.

=== PRODUCT CAMPAIGN DETAILS ===
Product Name: ${productName}
Product Description: ${productDescription}

=== USER CUSTOMIZATION REQUEST ===
${enhancedPrompt}

${previousContext}

=== YOUR MISSION ===
Create a CLASSY, SOPHISTICATED landing page for this product. The goal is to:
1. Capture visitor attention with elegant, premium aesthetics
2. Communicate the product's value proposition clearly
3. Convert visitors through a compelling CTA form

=== DESIGN STYLE GUIDELINES ===
- Use MUTED, SOPHISTICATED colors - NO bright neon or harsh contrasting colors
- Prefer soft gradients, subtle shadows, and elegant typography
- Think luxury brand aesthetics: clean, minimal, premium feel
- Color inspiration: soft neutrals, muted tones, subtle accents



=== LANDING PAGE STRUCTURE ===
Build a single-page campaign website with these sections:
1. HERO SECTION: Product image prominently displayed, catchy headline, sub-headline, primary CTA button
2. FEATURES/BENEFITS: 3-4 key benefits of the product with icons or illustrations
5. CTA SECTION: Email/phone capture form based on user specifications
6. FOOTER: Simple footer with brand name

=== TECHNICAL REQUIREMENTS ===
- SINGLE FILE: Everything goes in Home.jsx (/home/user/react-app/pages/Home.jsx)
- Tailwind CSS for styling - use custom colors extracted from the image
- Responsive design (mobile-first)
- Smooth scroll animations if applicable
- Form with proper validation
- NO external icon libraries - use emoji or CSS shapes

${
  previousContext
    ? "NOTE: This is an existing project. Only modify what's needed for the new request."
    : ""
}

OUTPUT FORMAT (Keep it clean and visual):

**🎨 Color Palette**
- Primary: [hex] - [usage]
- Accent: [hex] - [usage]  
- Text: [hex]

**📱 Page Sections**
1. Hero - [brief description]
2. Features - [brief description]
3. CTA Form - [brief description]
4. Footer

**✨ Key Design Elements**
- [2-3 bullet points about animations/effects]

Keep the plan SHORT and SCANNABLE. No code, no technical details. Just the visual design summary.
`;

    const messageContent: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: string }
    > = [{ type: "text", text: planningPrompt }];

    if (imageLink) {
      const base64Image = await imageUrlToBase64(imageLink);
      if (base64Image) {
        messageContent.push({
          type: "image_url",
          image_url: base64Image,
        });
        console.log("Planner: Image converted successfully");
      } else {
        console.log(
          "Planner: Failed to convert image, proceeding without image"
        );
      }
    }

    const messages = [
      new SystemMessage(
        "You are a creative director generating landing page design briefs. Output ONLY a short, visual design summary. Use emojis for headers. Keep it under 15 lines. No code, no technical specs. IMPORTANT: Use CLASSY, MUTED colors only - NO bright neons or harsh contrasts. Think luxury brand aesthetics."
      ),
      new HumanMessage({ content: messageContent }),
    ];

    await safeSendEvent(sendEvent, {
      e: "generating_plan",
      message: "Generating design brief...",
    });

    let planText = "";

    const response = await model.invoke(messages);
    planText =
      typeof response.content === "string"
        ? response.content
        : String(response.content || "");

    const formattedPlan = `**DESIGN BRIEF**

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
      message: ` ${formattedPlan}`,
    });

    return {
      plan: planText,
      current_node: "planner",
      execution_log: [{ node: "planner", status: "completed", plan: planText }],
    };
  } catch (e) {
    const errorMsg = `Planner node error: ${
      e instanceof Error ? e.message : String(e)
    }`;
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
    const baseTools = createToolsWithContext(sandbox, state.project_id);

    let validationContext = "";
    if (isRetry && validationIssues.length > 0) {
      validationContext = `\n\nCRITICAL: PREVIOUS BUILD HAD VALIDATION ISSUES
The previous Home.jsx had these problems that MUST be fixed:

${validationIssues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

YOU MUST FIX ALL THESE ISSUES in this build!
`;
    }

    const builderPrompt = `You have been provided with an implementation plan below.
Read and understand the plan carefully before starting.

IMPLEMENTATION PLAN:
${plan}

${validationContext}

DONT FORGET TO USE THE BELOW IMAGE LINK URL IN THE LANDING PAGE 
${state.image_link}

YOUR MISSION:
Build the COMPLETE single-page application in Home.jsx according to the plan above.

CRITICAL: SINGLE FILE APPROACH
- You can ONLY write to Home.jsx (located at /home/user/react-app/pages/Home.jsx)
- ALL functionality, state, and UI must go in this ONE file
- DO NOT try to create separate component files - they won't work
- Put helper functions inside the Home component if needed
- Use inline components or component functions within Home.jsx
- Do not use any 3rd packages no usage of icons is allowed from 3rd party packages

STYLING REQUIREMENTS (VERY IMPORTANT):
- Use CLASSY, SOPHISTICATED, MUTED colors only
- NO bright neon colors (no #FF0000, #00FF00, #00FFFF, etc.)
- NO harsh color contrasts - prefer subtle, elegant combinations
- Think luxury brand aesthetics: soft neutrals, muted tones, subtle accents
- Use soft gradients, subtle shadows, and clean typography
- Prefer colors like: slate, zinc, stone, neutral grays, soft blues, muted greens

ANALYTICS TRACKING (REQUIRED):
Add this useEffect at the start of your Home component to track page visits:

React.useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  fetch('${process.env.NEXT_PUBLIC_APP_URL}/api/analytics/${state.project_id}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
      utmContent: params.get('utm_content'),
      utmTerm: params.get('utm_term'),
      referrer: document.referrer
    })
  }).catch(() => {});
}, []);

AVAILABLE TOOLS:
1. read_file() - Read the current content of Home.jsx
2. create_file(content) - Write the complete Home.jsx content

STEP-BY-STEP PROCESS (DO EXACTLY THESE STEPS, THEN STOP):
1. Call read_file() ONCE to see current Home.jsx content
2. Analyze what needs to be added/changed based on the plan
3. Call create_file(content) ONCE with the COMPLETE new Home.jsx
4. IMMEDIATELY STOP - Do NOT call any more tools!

API FETCH LOGIC 
only use the api end point provided by the user and if the user has partial api data or url data please dont add the cta 
${state.user_prompt}


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
- If there is a phone number input set a limit of 10 numbers keep constraints
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
      let toolCallCount = 0;
      let fileCreatedSuccessfully = false;
      const MAX_TOOL_CALLS = 3;

      try {
        const stream = await agent.stream(
          { messages: messages },
          {
            streamMode: "updates",
          }
        );

        streamLoop: for await (const chunk of stream) {
          if (fileCreatedSuccessfully || toolCallCount >= MAX_TOOL_CALLS) {
            break streamLoop;
          }
          if (chunk && chunk.tools) {
            const toolsChunk = chunk.tools as Record<string, unknown>;

            if (toolsChunk.messages) {
              const messages = toolsChunk.messages as Array<
                Record<string, unknown>
              >;

              for (const msg of messages) {
                const content = String(msg.content || "");

                toolCallCount++;

                if (
                  content.includes("Home.jsx updated successfully") ||
                  content.includes("File created successfully")
                ) {
                  fileCreatedSuccessfully = true;
                  filesCreated.push("Home.jsx");
                  filesModified.push("Home.jsx");

                  await safeSendEvent(sendEvent, {
                    e: "file_created",
                    file: "Home.jsx",
                    message: "Home.jsx created/updated successfully",
                  });

                  break streamLoop;
                }

                if (toolCallCount >= MAX_TOOL_CALLS) {
                  break streamLoop;
                }
              }
            }
          }
        }

        if (fileCreatedSuccessfully) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          try {
            const productName = state.product_name || "Product";
            const indexPath = "/home/user/react-app/index.html";
            const indexContent = await sandbox.files.read(indexPath);
            const updatedIndex = indexContent.replace(
              /<title>.*?<\/title>/,
              `<title>${productName}</title>`
            );
            await sandbox.files.write(indexPath, updatedIndex);
          } catch (titleError) {
            console.error("Failed to update index.html title:", titleError);
          }
        }
      } catch (streamError) {
        console.error("Stream error:", streamError);
        throw streamError;
      }

      await safeSendEvent(sendEvent, {
        e: "builder_complete",
        files_created: filesCreated,
        files_modified: filesModified,
        message: fileCreatedSuccessfully
          ? "Building completed successfully"
          : "Building completed with warnings",
      });

      return {
        files_created: filesCreated,
        files_modified: filesModified,
        current_node: "builder",
        success: fileCreatedSuccessfully,
        retry_count: retryCount + 1,
        execution_log: [
          {
            node: "builder",
            status: fileCreatedSuccessfully ? "completed" : "partial",
            files_created: filesCreated,
            files_modified: filesModified,
            retry_count: retryCount + 1,
            tool_calls: toolCallCount,
          },
        ],
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("timeout")) {
        console.log("Builder agent timed out");

        await safeSendEvent(sendEvent, {
          e: "builder_error",
          message: "Builder agent timed out",
        });

        return {
          files_created: [],
          files_modified: [],
          current_node: "builder",
          success: false,
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
        message: `Builder agent execution error: ${
          e instanceof Error ? e.message : String(e)
        }`,
      });

      return {
        files_created: [],
        files_modified: [],
        current_node: "builder",
        success: false,
        execution_log: [
          {
            node: "builder",
            status: "error",
            files_created: [],
            files_modified: [],
            error: e instanceof Error ? e.message : String(e),
          },
        ],
      };
    }
  } catch (e) {
    const errorMsg = `Builder node error: ${
      e instanceof Error ? e.message : String(e)
    }`;
    console.error(errorMsg);

    await safeSendEvent(sendEvent, {
      e: "builder_error",
      message: errorMsg,
    });

    return {
      current_node: "builder",
      success: false,
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

    try {
      const fileContent = await sandbox.files.read(
        "/home/user/react-app/src/pages/Home.jsx"
      );

      if (!fileContent || fileContent.trim().length === 0) {
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

      const hasReactImport =
        fileContent.includes("import") && fileContent.includes("React");
      const hasExport = fileContent.includes("export default");
      const hasBasicStructure =
        fileContent.includes("function") || fileContent.includes("const");

      const validationIssues: string[] = [];

      if (!hasReactImport) validationIssues.push("Missing React imports");
      if (!hasExport) validationIssues.push("Missing export default statement");
      if (!hasBasicStructure)
        validationIssues.push("Missing component function/const declaration");

      const imageLink = state.image_link || "";
      if (imageLink) {
        const hasImageLink = fileContent.includes(imageLink);
        const hasImgTag =
          fileContent.includes("<img") || fileContent.includes("src=");

        if (!hasImageLink && !hasImgTag) {
          validationIssues.push(
            "Product image not found in the generated code - add the image URL to display the product"
          );
        } else if (!hasImageLink && hasImgTag) {
          console.log(
            "Validator: Image tag found but specific product image URL not detected"
          );
        }
      }

      const userPrompt = state.user_prompt || "";
      const hasApiSpecification =
        userPrompt.toLowerCase().includes("api specification") &&
        !userPrompt.includes("None provided");

      if (hasApiSpecification) {
        const hasForm =
          fileContent.includes("<form") || fileContent.includes("onSubmit");
        const hasInput =
          fileContent.includes("<input") ||
          fileContent.includes('type="email"') ||
          fileContent.includes('type="tel"') ||
          fileContent.includes('type="phone"');
        const hasFetch =
          fileContent.includes("fetch(") ||
          fileContent.includes("fetch (") ||
          fileContent.includes("axios") ||
          fileContent.includes("POST");

        if (!hasForm) {
          validationIssues.push(
            "CTA form not found - user requested a form with API integration"
          );
        }
        if (!hasInput) {
          validationIssues.push(
            "Form input field not found - add email/phone input for CTA"
          );
        }
        if (!hasFetch) {
          validationIssues.push(
            "API fetch/submit logic not found - add fetch call to submit form data"
          );
        }
      }

      const hasHeroSection =
        fileContent.toLowerCase().includes("hero") ||
        (fileContent.includes("min-h-screen") && fileContent.includes("flex"));
      if (!hasHeroSection) {
        validationIssues.push("Hero section not clearly defined");
      }

      const basicStructurePassed =
        hasReactImport && hasExport && hasBasicStructure;
      const hasContentIssues = validationIssues.length > 3;

      const validationPassed = basicStructurePassed && !hasContentIssues;

      console.log(
        `Validator: ${validationPassed ? "PASSED" : "FAILED"}`,
        validationIssues
      );

      await safeSendEvent(sendEvent, {
        e: validationPassed ? "validator_passed" : "validator_failed",
        validation_passed: validationPassed,
        issues: validationIssues,
        message: validationPassed
          ? `Validation passed${
              validationIssues.length > 0
                ? ` with ${validationIssues.length} warning(s)`
                : " successfully"
            }`
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
    const errorMsg = `Validator node error: ${
      e instanceof Error ? e.message : String(e)
    }`;
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
        await sandbox.commands
          .run("pkill -f 'vite'", {
            background: false,
          })
          .catch(() => {
            console.log("No existing dev server to kill");
          });

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
          execution_log: [
            {
              node: "executor",
              status: "completed",
              message: "Dev server started successfully",
            },
          ],
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
          error_message: `Failed to start dev server: ${
            devError instanceof Error ? devError.message : String(devError)
          }`,
          execution_log: [
            {
              node: "executor",
              status: "error",
              error: String(devError),
            },
          ],
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
        execution_log: [
          {
            node: "executor",
            status: "skipped",
            message: "No files were created",
          },
        ],
      };
    }
  } catch (e) {
    const errorMsg = `Executor node error: ${
      e instanceof Error ? e.message : String(e)
    }`;
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
