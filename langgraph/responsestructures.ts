
import { z } from "zod";
export const PlanSchema = z.object({
  overview: z.string().describe("Brief description of what the application does"),
  pages: z.array(z.object({
    name: z.string().describe("Page name"),
    route: z.string().describe("URL route for this page"),
    components: z.array(z.string()).describe("Components used in this page"),
  })).describe("List of pages/routes"),
  dependencies: z.array(z.string()).describe("NPM packages needed"),
  file_structure: z.array(z.string()).describe("Files to create with paths"),
  implementation_steps: z.array(z.string()).describe("Step by step implementation guide"),
});

export type PlanType = z.infer<typeof PlanSchema>;
