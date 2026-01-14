import { NextRequest, NextResponse } from "next/server";
import { sandboxService } from "@/langgraph/services";
import prisma from "@/lib/prisma";


export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HOME_FILE_PATH = "/home/user/react-app/src/pages/Home.jsx";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { chatId: id },
    });

    if (project?.state === "DEPLOYED" && project.deployedUrl) {
      return NextResponse.json({
        host: null,
        files: [],
        projectState: project.state,
        projectId: project.id,
        deployedUrl: project.deployedUrl,
      });
    }

    const sandbox = await sandboxService.getSandbox(id);

    if (project?.generatedCode && project.generatedCode.trim()) {
      try {
        await sandbox.files.write(HOME_FILE_PATH, project.generatedCode);
        console.log("Restored saved Home.jsx to sandbox");
      } catch (writeError) {
        console.error("Failed to restore Home.jsx:", writeError);
      }
    }

    const host = sandbox.getHost(5173);
    const files = await sandboxService.getSandboxFiles(id);

    return NextResponse.json({
      host,
      files,
      projectState: project?.state || "INITIAL",
      projectId: project?.id,
    });
  } catch (error) {
    console.error("Failed to get sandbox info:", error);
    return NextResponse.json(
      { error: "Failed to get sandbox info" },
      { status: 500 }
    );
  }
}
