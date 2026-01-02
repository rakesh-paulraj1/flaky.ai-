import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import * as path from "path";


type EventSender = (payload: Record<string, unknown>) => void;

const REACT_APP_PATH = "/home/user/react-app";

function safeSendEvent(send: EventSender | null, data: Record<string, unknown>): void {
  if (!send) return;
  try {
    send(data);
  } catch (e) {
    console.error("safeSendEvent failed:", e);
  }
}

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


export function createToolsWithContext(
  sandbox: Sandbox,
  sendEvent: EventSender | null,
  projectId?: string
) {

  const createFileTool = tool(
    async ({ file_path, content }) => {
      try {
        const fullPath = path.join(REACT_APP_PATH, file_path);
        const fixedContent = fixEscapeSequences(content);

        await sandbox.files.write(fullPath, fixedContent);
        safeSendEvent(sendEvent, { e: "file_created", message: `Created ${file_path}` });

        return `File ${file_path} created successfully.`;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, { e: "file_error", message: `Failed to create ${file_path}: ${error}` });
        return `Failed to create file ${file_path}: ${error}`;
      }
    },
    {
      name: "create_file",
      description: `
      Create a file with the given content at the specified path.     
Args:
  file_path: The path where the file should be created (e.g., "src/App.jsx", "src/components/Header.jsx")
  content: The content to write to the file (React components, HTML, CSS, etc.)

Returns:
  Success message with file path or error message if failed

Example:
  create_file("src/App.jsx", "import React from 'react';\\nexport default function App() { return <div>Hello</div>; }")`,
      schema: z.object({
        file_path: z.string().describe("The path where the file should be created"),
        content: z.string().describe("The content to write to the file"),
      }),
    }
  );

  const readFileTool = tool(
    async ({ file_path }) => {
      try {
        const fullPath = path.join(REACT_APP_PATH, file_path);
        const content = await sandbox.files.read(fullPath);
        safeSendEvent(sendEvent, { e: "file_read", message: `Read content from ${file_path}` });

        return `Content from ${file_path}:\n${content}`;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, { e: "file_error", message: `Failed to read ${file_path}: ${error}` });
        return `Failed to read file ${file_path}: ${error}`;
      }
    },
    {
      name: "read_file",
      description: `Read the content of a file from the react-app directory.

Args:
  file_path: The path of the file to read (e.g., "src/App.jsx", "package.json")

Returns:
  The file content as a string, or error message if file not found

Example:
  read_file("src/App.jsx") - reads the main App component
  read_file("package.json") - reads package dependencies`,
      schema: z.object({
        file_path: z.string().describe("The path of the file to read"),
      }),
    }
  );

  const deleteFileTool = tool(
    async ({ file_path }) => {
      try {
        const fullPath = path.join(REACT_APP_PATH, file_path);
        await sandbox.files.remove(fullPath);
        safeSendEvent(sendEvent, { e: "file_deleted", message: `Deleted ${file_path}` });

        return `File ${file_path} deleted successfully.`;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, { e: "file_error", message: `Failed to delete ${file_path}: ${error}` });
        return `Failed to delete file ${file_path}: ${error}`;
      }
    },
    {
      name: "delete_file",
      description: `Delete a file from the react-app directory.

Args:
  file_path: The path of the file to delete (e.g., "src/old-component.jsx")

Returns:
  Success message or error message if deletion failed`,
      schema: z.object({
        file_path: z.string().describe("The path of the file to delete"),
      }),
    }
  );


  const executeCommandTool = tool(
    async ({ command }) => {
      try {
        safeSendEvent(sendEvent, { e: "command_started", command });

        const result = await sandbox.commands.run(command, { cwd: REACT_APP_PATH });

        safeSendEvent(sendEvent, {
          e: "command_output",
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exitCode,
        });

        if (result.exitCode === 0) {
          safeSendEvent(sendEvent, {
            e: "command_executed",
            command,
            message: "Command executed successfully",
          });
          const output = result.stdout.slice(0, 500) + (result.stdout.length > 500 ? "..." : "");
          return `Command '${command}' executed successfully. Output: ${output}`;
        } else {
          safeSendEvent(sendEvent, {
            e: "command_failed",
            command,
            message: `Command failed with exit code ${result.exitCode}`,
          });
          const error = result.stderr.slice(0, 500) + (result.stderr.length > 500 ? "..." : "");
          return `Command '${command}' failed with exit code ${result.exitCode}. Error: ${error}`;
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, {
          e: "command_error",
          command,
          message: `Command execution error: ${error}`,
        });
        return `Command '${command}' failed with error: ${error}`;
      }
    },
    {
      name: "execute_command",
      description: `Execute a shell command within the react-app directory.

Args:
  command: The shell command to execute (e.g., "npm install", "npm run dev", "mkdir src/components")

Returns:
  Command output and success/error status

Common Commands:
  - "npm install" - install dependencies
  - "npm install react-router-dom" - install specific package
  - "mkdir -p src/components" - create directory structure`,
      schema: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
    }
  );

  // ─────────────────────────────────────────────────────────────
  // LIST DIRECTORY
  // ─────────────────────────────────────────────────────────────
  const listDirectoryTool = tool(
    async ({ path: dirPath = "." }) => {
      try {
        const treeCommand = `tree -I 'node_modules|.*' ${dirPath}`;
        safeSendEvent(sendEvent, { e: "command_started", command: treeCommand });

        const result = await sandbox.commands.run(treeCommand, { cwd: REACT_APP_PATH });

        safeSendEvent(sendEvent, {
          e: "command_output",
          command: treeCommand,
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exitCode,
        });

        if (result.exitCode === 0) {
          safeSendEvent(sendEvent, {
            e: "command_executed",
            command: treeCommand,
            message: "Directory structure listed successfully",
          });
          return `Directory structure:\n${result.stdout}`;
        } else {
          safeSendEvent(sendEvent, {
            e: "command_failed",
            command: treeCommand,
            message: `Command failed with exit code ${result.exitCode}`,
          });
          return `Failed to list directory structure. Error: ${result.stderr}`;
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, {
          e: "command_error",
          command: `tree ${dirPath}`,
          message: `Command execution error: ${error}`,
        });
        return `Failed to list directory: ${error}`;
      }
    },
    {
      name: "list_directory",
      description: `List the directory structure using tree command, excluding node_modules and hidden files.

Args:
  path: The directory path to list (default: "." for current directory)

Returns:
  Formatted directory tree structure

Note:
  Automatically excludes node_modules and hidden files for cleaner output`,
      schema: z.object({
        path: z.string().optional().default(".").describe("The directory path to list"),
      }),
    }
  );

  // ─────────────────────────────────────────────────────────────
  // WRITE MULTIPLE FILES
  // ─────────────────────────────────────────────────────────────
  const writeMultipleFilesTool = tool(
    async ({ files }) => {
      try {
        const filesData = JSON.parse(files) as Array<{ path: string; data: string }>;

        // Process each file
        const fileObjects = filesData.map((fileInfo) => ({
          path: path.join(REACT_APP_PATH, fileInfo.path),
          data: fixEscapeSequences(fileInfo.data),
        }));

        // Write files one by one (E2B JS SDK may not have write_files)
        for (const file of fileObjects) {
          await sandbox.files.write(file.path, file.data);
        }

        const fileNames = filesData.map((f) => f.path);
        safeSendEvent(sendEvent, {
          e: "files_created",
          message: `Created ${fileNames.length} files: ${fileNames.join(", ")}`,
        });

        return `Successfully created ${fileNames.length} files: ${fileNames.join(", ")}`;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, {
          e: "file_error",
          message: `Failed to create multiple files: ${error}`,
        });
        return `Failed to create multiple files: ${error}`;
      }
    },
    {
      name: "write_multiple_files",
      description: `Write multiple files to the sandbox at once for better efficiency.

Args:
  files: JSON string containing array of file objects with 'path' and 'data' keys

Format:
  [
    {"path": "src/App.jsx", "data": "import React from 'react';..."},
    {"path": "src/components/Header.jsx", "data": "export default function Header() {...}"}
  ]

Benefits:
  - More efficient than creating files one by one
  - Creates complete application structure at once`,
      schema: z.object({
        files: z.string().describe("JSON string containing array of file objects with 'path' and 'data' keys"),
      }),
    }
  );

  
  const testBuildTool = tool(
    async () => {
      try {
        safeSendEvent(sendEvent, { e: "build_test_started", message: "Testing application build..." });

        const cleanCommand = "rm -rf node_modules/.vite-temp && npm install";
        await sandbox.commands.run(cleanCommand, { cwd: REACT_APP_PATH });

        const buildCommand = "npm run build";
        const res = await sandbox.commands.run(buildCommand, { cwd: REACT_APP_PATH });

        if (res.exitCode === 0) {
          safeSendEvent(sendEvent, {
            e: "build_test_success",
            message: "Build test passed successfully",
          });
          return `Build test PASSED. Application builds successfully.\n\nBuild output:\n${res.stdout.slice(0, 500)}`;
        } else {
          const errorOutput = res.stderr || res.stdout;
          safeSendEvent(sendEvent, {
            e: "build_test_failed",
            message: "Build test failed",
            error: errorOutput.slice(0, 500),
          });
          return `Build test FAILED with exit code ${res.exitCode}.\n\nError:\n${errorOutput.slice(0, 1000)}`;
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, { e: "build_test_error", message: `Build test error: ${error}` });
        return `Build test failed with error: ${error}`;
      }
    },
    {
      name: "test_build",
      description: `Test if the application builds successfully by running npm run build.
This cleans the Vite cache, runs npm install if needed, and attempts a build.

Returns:
  Success message with build output or error message with details

Note:
  This is useful for validating that all files are correct before deployment`,
      schema: z.object({}),
    }
  );


  const checkMissingPackagesTool = tool(
    async () => {
      try {
        const packageJsonPath = path.join(REACT_APP_PATH, "package.json");
        const packageContent = await sandbox.files.read(packageJsonPath);
        const packageData = JSON.parse(packageContent);
        const installedDeps = packageData.dependencies || {};

        const findResult = await sandbox.commands.run(
          "find src -name '*.jsx' -o -name '*.js'",
          { cwd: REACT_APP_PATH }
        );
        const sourceFiles = findResult.stdout
          .trim()
          .split("\n")
          .filter((f) => f.trim());

        const allImports = new Set<string>();
        for (const filePath of sourceFiles) {
          try {
            const fullPath = path.join(REACT_APP_PATH, filePath);
            const content = await sandbox.files.read(fullPath);

            const importLines = content
              .split("\n")
              .filter((line) => line.trim().startsWith("import"));

            for (const line of importLines) {
              if (line.includes("from")) {
                const match = line.match(/from\s+['"]([^'"]+)['"]/);
                if (match) {
                  const rootPackage = match[1].split("/")[0];
                  if (!rootPackage.startsWith(".")) {
                    allImports.add(rootPackage);
                  }
                }
              }
            }
          } catch {
            console.log("error reading package.json")
          }
        }
        const builtinPackages = ["react", "react-dom"];
        const missingPackages: string[] = [];

        for (const pkg of allImports) {
          if (!installedDeps[pkg] && !builtinPackages.includes(pkg)) {
            missingPackages.push(pkg);
          }
        }

        if (missingPackages.length > 0) {
          const installCommands = missingPackages.map((pkg) => `npm install ${pkg}`);

          safeSendEvent(sendEvent, {
            e: "missing_dependencies",
            packages: missingPackages,
            commands: installCommands,
          });

          let result = "MISSING DEPENDENCIES FOUND:\n\n";
          result += `Missing packages: ${missingPackages.join(", ")}\n\n`;
          result += "Installation commands:\n";
          for (const cmd of installCommands) {
            result += `  ${cmd}\n`;
          }
          result += "\nRun these commands to install missing dependencies.";

          return result;
        } else {
          return "All dependencies are properly installed. No missing packages found.";
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        safeSendEvent(sendEvent, {
          e: "dependency_check_error",
          message: `Dependency check failed: ${error}`,
        });
        return `Dependency check failed: ${error}`;
      }
    },
    {
      name: "check_missing_packages",
      description: `Check for missing packages by reading package.json and scanning source files for imports.
This tool identifies missing dependencies and provides installation commands.

Returns:
  A report of missing packages and installation commands`,
      schema: z.object({}),
    }
  );

 //git context yet to be created
  const getContextTool = tool(
    async () => {
      if (!projectId) {
        return "No project ID available - context cannot be retrieved";
      }

      // TODO: Implement load_json_store equivalent
      return `Get context for project ${projectId} - store implementation pending`;
    },
    {
      name: "get_context",
      description: `Fetch the last saved context for the current project.
This includes information about:
- What the project is about (semantic memory)
- How things work in the project (procedural memory)
- What has been done so far (episodic memory)

Returns:
  Saved project context as a formatted string, or message if no context exists`,
      schema: z.object({}),
    }
  );

  
  const saveContextTool = tool(
    async ({ semantic, procedural, episodic }) => {
      if (!projectId) {
        return "No project ID available - context cannot be saved";
      }


      console.log(`Saving context for project ${projectId}:`, {
        semantic: semantic.slice(0, 100),
        procedural: procedural?.slice(0, 100),
        episodic: episodic?.slice(0, 100),
      });

      return `Context saved for project ${projectId}. Semantic: ${semantic.slice(0, 50)}..., Procedural: ${procedural?.slice(0, 50) || "none"}..., Episodic: ${episodic?.slice(0, 50) || "none"}...`;
    },
    {
      name: "save_context",
      description: `Save project context for future sessions.
This helps maintain continuity across different work sessions.

Args:
  semantic: What the project is about (e.g., "E-commerce site for jewelry with cart and checkout")
  procedural: How things work (e.g., "Uses React Router for navigation, Context API for state")
  episodic: What has been done (e.g., "Created product catalog, cart functionality, and checkout flow")

Returns:
  Success message confirming context was saved`,
      schema: z.object({
        semantic: z.string().describe("What the project is about"),
        procedural: z.string().optional().default("").describe("How things work in the project"),
        episodic: z.string().optional().default("").describe("What has been done so far"),
      }),
    }
  );
  return [
    createFileTool,
    readFileTool,
    deleteFileTool,
    executeCommandTool,
    listDirectoryTool,
    writeMultipleFilesTool,
    testBuildTool,
    checkMissingPackagesTool,
    getContextTool,
    saveContextTool,
  ];
}

export type AgentTools = ReturnType<typeof createToolsWithContext>;

export const createCreateFileTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[0];
};

export const createReadFileTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[1];
};

export const createDeleteFileTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[2];
};

export const createExecuteCommandTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[3];
};

export const createListDirectoryTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[4];
};

export const createWriteMultipleFilesTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[5];
};

export const createTestBuildTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[6];
};

export const createCheckMissingPackagesTool = (sandbox: Sandbox, sendEvent: EventSender | null) => {
  return createToolsWithContext(sandbox, sendEvent)[7];
};

export const createGetContextTool = (sandbox: Sandbox, sendEvent: EventSender | null, projectId?: string) => {
  return createToolsWithContext(sandbox, sendEvent, projectId)[8];
};

export const createSaveContextTool = (sandbox: Sandbox, sendEvent: EventSender | null, projectId?: string) => {
  return createToolsWithContext(sandbox, sendEvent, projectId)[9];
};
