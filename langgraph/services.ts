import { Sandbox } from "@e2b/code-interpreter";
import fs from "fs/promises";
import path from "path";

const SANDBOX_TIMEOUT = 300 * 1000;
const PROJECTS_DIR = path.join(process.cwd(), "projects");
const E2B_TEMPLATE_ID = "fabwcz4cxczc6d5r09pa";
const DEV_SERVER_PORT = 5173;

interface SandboxInfo {
  sandbox: Sandbox;
  lastAccess: number;
  serverReady: boolean;
}

export class SandboxService {
  private static instance: SandboxService;
  private sandboxes: Map<string, SandboxInfo> = new Map();
  private pendingRequests: Map<string, Promise<Sandbox>> = new Map();
  private scheduledCloses: Map<string, NodeJS.Timeout> = new Map();

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
    const current_time = Date.now();
    const existing = this.sandboxes.get(id);

    if (existing) {
      console.log("saandbox already exixts for id", id);
      const time_elapsed = current_time - existing.lastAccess;
      if (time_elapsed < SANDBOX_TIMEOUT) {
        try {
          await existing.sandbox.setTimeout(SANDBOX_TIMEOUT);
          existing.lastAccess = current_time;
          
          const scheduled = this.scheduledCloses.get(id);
          if (scheduled) {
            clearTimeout(scheduled);
            this.scheduledCloses.delete(id);
          }
          console.log(` Reusing existing sandbox for ${id}`);
          if (!existing.serverReady) {
            console.log(` Dev server not ready for ${id}, starting...`);
            await this.startDevServer(id, existing.sandbox);
          }

          return existing.sandbox;
        } catch (error) {
          console.warn(
            `Defunct sandbox detected for ${id}:`,
            error
          );
          this.sandboxes.delete(id);
        }
      } else {
        console.log(` Sandbox expired for ${id}, recreating...`);
        try {
          await existing.sandbox.kill();
        } catch (e) {
          console.log("Failed to kill expired sandbox", e);
        }
        this.sandboxes.delete(id);
      }
    }

    console.log(`Initializing new sandbox for project id = ${id}`);
    const sandbox = await Sandbox.create(E2B_TEMPLATE_ID);

    console.log(
      `[Lifecycle]Sandbox created: ${sandbox.sandboxId} for project ${id}`
    );

    this.sandboxes.set(id, {
      sandbox,
      lastAccess: current_time,
      serverReady: false,
    });

    await this.startDevServer(id, sandbox);

    return sandbox;
  }

  public scheduleCloseSandbox(id: string, ttlMs = 5 * 60 * 1000) {
    const existingTimer = this.scheduledCloses.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        console.log(`Scheduled close triggered for sandbox ${id}`);
        await this.closeSandbox(id);
      } catch (e) {
        console.error(`Error during scheduled sandbox close for ${id}:`, e);
      }
    }, ttlMs);

    this.scheduledCloses.set(id, timer);
  }

  private async startDevServer(id: string, sandbox: Sandbox): Promise<void> {
    console.log(` Starting dev server for ${id}...`);

    try {
      await sandbox.commands.run("cd /home/user/react-app && npm run dev", {
        background: true,
      });
      
    
      const info = this.sandboxes.get(id);
      if (info) {
        info.serverReady = true;
        console.log(` Dev server marked as ready for ${id}`);
      }
    } catch (error) {
      console.error(
        `Failed to start dev server for ${id}:`,
        error
      );
    }
  }

  public async getHost(id: string): Promise<string> {
    const sandbox = await this.getSandbox(id);
    return sandbox.getHost(DEV_SERVER_PORT);
  }

  public async isServerReady(id: string): Promise<boolean> {
    const info = this.sandboxes.get(id);
    return info?.serverReady || false;
  }

  private async restoreFilesFromDisk(id: string, sandbox: Sandbox) {
    const projectPath = path.join(PROJECTS_DIR, id);
    try {
      await fs.access(projectPath);
      console.log(` Restoring files for ${id}...`);

      const files = await this.getAllFiles(projectPath);
      console.log(`Found ${files.length} files to restore`);

      for (const file of files) {
        const relativePath = path.relative(projectPath, file);
        const content = await fs.readFile(file);

        await sandbox.files.write(
          path.join("/home/user/react-app", relativePath),
          content.toString()
        );
      }

      console.log(`Files restored for ${id}`);
    } catch {
      console.log(`No files to restore for project ${id}`);
    }
  }

  public async getSandboxFiles(id: string): Promise<string[]> {
    const info = this.sandboxes.get(id);
    if (!info) {
      console.log(`No sandbox found for ${id} in getSandboxFiles`);
      return [];
    }

    try {
      const get_files_script = `
import os
import json

def list_files_recursive(path):
    file_structure = []
    if not os.path.exists(path):
        return []
    for root, dirs, files in os.walk(path):
        # Filter out common directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__', '.next']]
        for name in files:
            full_path = os.path.join(root, name)
            rel_path = os.path.relpath(full_path, path)
            if not rel_path.startswith('..'):
                file_structure.append(rel_path)
    return file_structure

print(json.dumps(list_files_recursive("/home/user/react-app")))
`;
      await info.sandbox.files.write("/tmp/list_files.py", get_files_script);
      const proc = await info.sandbox.commands.run(
        "python3 /tmp/list_files.py"
      );

      if (proc.exitCode === 0) {
        const files = JSON.parse(proc.stdout.trim() || "[]");
        console.log(`Found ${files.length} files for project ${id}`);
        return files;
      }
      console.error(`List files script failed for ${id}:`,
        proc.stderr
      );
      return [];
    } catch (error) {
      console.error(
        `Failed to list files for project ${id}:`,
        error
      );
      return [];
    }
  }

  public async snapshotProjectFiles(id: string) {
    const info = this.sandboxes.get(id);
    if (!info) return;

    const projectPath = path.join(PROJECTS_DIR, id);
    await this.ensureDirectory(projectPath);

    try {
      console.log(`Snapshotting files for ${id}...`);

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
        console.log(`Snapshotting ${files.length} files...`);

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

        console.log(`Snapshot complete for ${id}`);
      }
    } catch (error) {
      console.error(
        `Failed to snapshot files for ${id}:`,
        error
      );
    }
  }

  public async readSandboxFile(id: string, filePath: string): Promise<string> {
    const sandbox = await this.getSandbox(id);
    const normalizedPath = path
      .normalize(filePath)
      .replace(/^(\.\.(\/|\\|$))+/, "");

    const possiblePaths = [
      path.join("/home/user/react-app", normalizedPath),
      path.join("/home/user", normalizedPath),
      normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`,
    ];

    for (const p of possiblePaths) {
      try {
        const content = await sandbox.files.read(p);
        return content;
      } catch {
        continue;
      }
    }

    throw new Error(`File not found: ${filePath}`);
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
   
    const scheduled = this.scheduledCloses.get(id);
    if (scheduled) {
      clearTimeout(scheduled);
      this.scheduledCloses.delete(id);
    }

    if (info) {
      console.log(`Closing sandbox for ${id}`);
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
