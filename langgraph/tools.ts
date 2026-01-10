import { tool, ToolRuntime } from "@langchain/core/tools";
import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import * as path from "path";
import prisma from "@/lib/prisma";

const REACT_APP_PATH = "/home/user/react-app/src/pages";

function fixEscapeSequences(content: string): string {
  try {
    return content
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r");
  } catch {
    return content;
  }
}

export function createToolsWithContext(sandbox: Sandbox, projectId?: string) {
  const createFileTool = tool(
    async ({ content }, config: ToolRuntime) => {
      const writer = config.writer;
      try {
        const fixedContent = fixEscapeSequences(content);
        const homePath = path.join(REACT_APP_PATH, "Home.jsx");
        if (writer) {
          writer(`Updating the Home.jsx file`);
        }

        await sandbox.files.write(homePath, fixedContent);

        if (projectId) {
          try {
            await prisma.project.update({
              where: { chatId: projectId },
              data: { generatedCode: fixedContent },
            });
          } catch (dbError) {
            console.error("Failed to save generated code to DB:", dbError);
          }
        }

        return `Home.jsx updated successfully with new content.`;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return `Failed to update Home.jsx: ${error}`;
      }
    },
    {
      name: "create_file",
      description: `
      Update the Home.jsx file with new content. This tool only modifies the single-page application's Home.jsx file.
      
CRITICAL: This tool ONLY writes to Home.jsx - you cannot create other files.
All your application code must go into this single Home.jsx component.

Args:
  content: The complete content for Home.jsx (React component with all features)
Returns:
  Success message or error message if failed
Example:
  create_file("import React from 'react';\\nexport default function Home() { return <div>My App</div>; }")
  
Note: Put ALL your application logic, state, and UI in Home.jsx since this is a single-page app.`,
      schema: z.object({
        content: z
          .string()
          .describe("The complete content to write to Home.jsx"),
      }),
    }
  );

  const readFileTool = tool(
    async (config: ToolRuntime) => {
      try {
        const homePath = path.join(REACT_APP_PATH, "Home.jsx");
        const writer = config.writer;
        if (writer) {
          writer(`Reading the Home.jsx file`);
        }
        const content = await sandbox.files.read(homePath);

        return `Content from Home.jsx:\n${content}`;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        return `Failed to read Home.jsx: ${error}`;
      }
    },
    {
      name: "read_file",
      description: `Read the current content of Home.jsx.
CRITICAL: This tool ONLY reads Home.jsx - the single-page application file.
This tool can also be used of checking the Home.jsx after the creation of the user requested application 
Returns:
  The current content of Home.jsx as a string, or error message if file not found
Use this to:
- Check what's currently in Home.jsx before making changes
- See the existing code structure
- Understand what features are already implemented`,
      schema: z.object({}),
    }
  );
  return [createFileTool, readFileTool];
}

export type AgentTools = ReturnType<typeof createToolsWithContext>;

export const createCreateFileTool = (sandbox: Sandbox) => {
  return createToolsWithContext(sandbox)[0];
};

export const createReadFileTool = (sandbox: Sandbox) => {
  return createToolsWithContext(sandbox)[1];
};
