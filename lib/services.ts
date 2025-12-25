import { Sandbox } from "@e2b/code-interpreter";
import fs from "fs/promises";
import path from "path";

const SANDBOX_TIMEOUT = 1800;
const PROJECTS_DIR = path.join(process.cwd(), "projects");

const E2B_TEMPLATE_ID = "fabwcz4cxczc6d5r09pa";

interface SandboxInfo {
  sandbox: Sandbox;
  lastAccess: number;
}

export class SandboxService {
  private static instance: SandboxService;
  private sandboxes: Map<string, SandboxInfo> = new Map();
  private pendingRequests: Map<string, Promise<Sandbox>> = new Map();

  private constructor() {
    this.ensureDirectory(PROJECTS_DIR);
  }

  public static getInstance(): SandboxService {
    if (!SandboxService.instance) {
      SandboxService.instance = new SandboxService();
    }
    return SandboxService.instance;
  }

  private async ensureDirectory(dir: string) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  public async getSandbox(id: string): Promise<Sandbox> {
    const pending = this.pendingRequests.get(id);
    if (pending) {
      return pending;
    }

    const request = this.doGetSandbox(id);
    this.pendingRequests.set(id, request);

    try {
      const sandbox = await request;
      return sandbox;
    } finally {
      this.pendingRequests.delete(id);
    }
  }

  private async doGetSandbox(id: string): Promise<Sandbox> {
    const now = Date.now();
    const existing = this.sandboxes.get(id);

    if (existing) {
      const { sandbox, lastAccess } = existing;
      if (now - lastAccess < SANDBOX_TIMEOUT * 1000) {
        try {
          if (typeof sandbox.setTimeout === "function") {
            await sandbox.setTimeout(SANDBOX_TIMEOUT);
          }
          await sandbox.files.list("/");

          existing.lastAccess = now;
          return sandbox;
        } catch {
          console.warn(
            `Sandbox for project ${id} is defunct or unresponsive. Recreating...`
          );
          // Crucial: remove from cache first
          this.sandboxes.delete(id);
          try {
            await sandbox.kill();
          } catch {
            // Ignore errors when killing a dead sandbox
          }
        }
      } else {
        try {
          await sandbox.kill();
        } catch (e) {
          console.log("Failed to kill expired sandbox", e);
        }
        this.sandboxes.delete(id);
      }
    }

    const sandbox = await Sandbox.create(E2B_TEMPLATE_ID);

    this.sandboxes.set(id, {
      sandbox,
      lastAccess: now,
    });

    await this.restoreFilesFromDisk(id, sandbox);

    // Start dev server in the background without blocking the return of the sandbox
    // This allows concurrent requests (like file listing) to proceed while the app boots
    this.startDevServer(sandbox).catch((error) => {
      console.error("Failed to start application in sandbox:", error);
    });

    return sandbox;
  }

  private async startDevServer(sandbox: Sandbox) {
    console.log(`Starting dev server in sandbox ${sandbox.sandboxId}...`);
    await sandbox.commands.run("npm run dev", {
      background: true,
      cwd: "/home/user/react-app",
    });

    // Optionally we could wait for port here if we wanted to track internal state,
    // but the frontend already polls the URL, so background is fine.
  }

  private async restoreFilesFromDisk(id: string, sandbox: Sandbox) {
    const projectPath = path.join(PROJECTS_DIR, id);
    try {
      await fs.access(projectPath);
      const files = await this.getAllFiles(projectPath);
      for (const file of files) {
        const relativePath = path.relative(projectPath, file);
        const content = await fs.readFile(file);

        // Always restore to /home/user/react-app to match build scripts
        await sandbox.files.write(
          path.join("/home/user/react-app", relativePath),
          content.toString()
        );
      }
    } catch {
      console.log(`No files to restore for project ${id}`);
    }
  }

  public async snapshotProjectFiles(id: string) {
    const info = this.sandboxes.get(id);
    if (!info) return;

    const projectPath = path.join(PROJECTS_DIR, id);
    await this.ensureDirectory(projectPath);

    try {
      // Use the same recursive listing logic as the API
      const get_files_script = `
import os
import json

def list_files_recursive(path):
    file_structure = []
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__', '.next']]
        for name in files:
            file_structure.append(os.path.join(root, name))
    return file_structure

print(json.dumps(list_files_recursive("/home/user/react-app")))
`;
      await info.sandbox.files.write(
        "/tmp/snapshot_helper.py",
        get_files_script
      );
      const proc = await info.sandbox.commands.run(
        "python3 /tmp/snapshot_helper.py"
      );

      if (proc.exitCode === 0) {
        const files: string[] = JSON.parse(proc.stdout.trim() || "[]");
        for (const fullPath of files) {
          try {
            const content = await info.sandbox.files.read(fullPath);
            const relativeToProject = path.relative(
              "/home/user/react-app",
              fullPath
            );
            const targetPath = path.join(projectPath, relativeToProject);

            await this.ensureDirectory(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
          } catch (e) {
            console.warn(`Could not read file ${fullPath} during snapshot`, e);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to snapshot files for project ${id}:`, error);
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? this.getAllFiles(res) : res;
      })
    );
    return Array.prototype.concat(...files);
  }

  public async closeSandbox(id: string) {
    const info = this.sandboxes.get(id);
    if (info) {
      try {
        await info.sandbox.kill();
      } catch (error) {
        console.error(`Error killing sandbox for project ${id}:`, error);
      }
      this.sandboxes.delete(id);
    }
  }
}

const globalForSandbox = globalThis as unknown as {
  sandboxService: SandboxService | undefined;
};

export const sandboxService =
  globalForSandbox.sandboxService ?? SandboxService.getInstance();

if (process.env.NODE_ENV !== "production")
  globalForSandbox.sandboxService = sandboxService;
