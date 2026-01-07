import fs from "fs";
import path from "path";

const promptPath = path.join(process.cwd(), "langgraph", "prompt.md");

let prompts = "";
try {
  if (fs.existsSync(promptPath)) {
    prompts = fs.readFileSync(promptPath, "utf-8");
  } else {
    console.warn(`Prompt file not found at ${promptPath}`);
    prompts = "";
  }
} catch (err) {
  console.error("Failed to read prompt file:", err);
  prompts = "";
}

export const Prompts = prompts;