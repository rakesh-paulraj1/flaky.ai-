import { NextRequest, NextResponse } from "next/server";
import { sandboxService } from "@/langgraph/services";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sandbox = await sandboxService.getSandbox(id);
    const host = sandbox.getHost(5173);
    const files = await sandboxService.getSandboxFiles(id);

    return NextResponse.json({
      host,
      files,
    });
  } catch (error) {
    console.error("Failed to get sandbox info:", error);
    return NextResponse.json(
      { error: "Failed to get sandbox info" },
      { status: 500 }
    );
  }
}
