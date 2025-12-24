import CodeInterpreter from "@e2b/code-interpreter";
import fs from "fs/promises";
import path from "path";
import { Sandbox } from 'e2b';



const SANDBOX_TIMEOUT = 1800; // 30 minutes in seconds
const PROJECTS_DIR = path.join(process.cwd(), "projects");

const E2B_TEMPLATE_ID = "fabwcz4cxczc6d5r09pa";

interface SandboxInfo {
  sandbox: CodeInterpreter;
  lastAccess: number;
}

export class SandboxService {
  private static instance: SandboxService;
  private sandboxes: Map<string, SandboxInfo> = new Map();

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

  public async getSandbox(id: string): Promise<CodeInterpreter> {
    const now = Date.now();
    const existing = this.sandboxes.get(id);

    if (existing) {
      const { sandbox, lastAccess } = existing;
      if (now - lastAccess < SANDBOX_TIMEOUT * 1000) {

        try {
          if (typeof sandbox.setTimeout === "function") {
            await sandbox.setTimeout(SANDBOX_TIMEOUT);
          }
        } catch (e) {
          console.error("Failed to extend sandbox timeout", e);
        }
        existing.lastAccess = now;
        return sandbox;
      } else {
        await sandbox.kill();
        this.sandboxes.delete(id);
      }
    }
    
    const sandbox = await Sandbox.create(E2B_TEMPLATE_ID);


    this.sandboxes.set(id, {
      sandbox,
      lastAccess: now,
    });

    // Restore files from disk
    await this.restoreFilesFromDisk(id, sandbox);

    return sandbox;
  }

  private async restoreFilesFromDisk(id: string, sandbox: CodeInterpreter) {
    const projectPath = path.join(PROJECTS_DIR, id);
    try {
      await fs.access(projectPath);
      const files = await this.getAllFiles(projectPath);
      for (const file of files) {
        const relativePath = path.relative(projectPath, file);
        const content = await fs.readFile(file);
        // Ensure content is passed correctly - Buffer should be fine in recent versions
        await sandbox.files.write(relativePath, content.toString());
      }

      // Run cleanup or initialization if needed (e.g., removing Vite cache as mentioned in service.py)
      // await sandbox.commands.run("rm -rf node_modules/.vite");
    } catch (err) {
      // Project directory might not exist yet
      console.log(`No files to restore for project ${id}`);
    }
  }

  public async snapshotProjectFiles(id: string) {
    const info = this.sandboxes.get(id);
    if (!info) return;

    const projectPath = path.join(PROJECTS_DIR, id);
    await this.ensureDirectory(projectPath);

    const files = await info.sandbox.files.list("/");
    for (const file of files) {
      if (file.type === "dir") continue;
      const content = await info.sandbox.files.read(file.path);
      const targetPath = path.join(projectPath, file.path);
      await this.ensureDirectory(path.dirname(targetPath));
      await fs.writeFile(targetPath, content);
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
      await info.sandbox.kill();
      this.sandboxes.delete(id);
    }
  }
}

export const sandboxService = SandboxService.getInstance();
