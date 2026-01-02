import { NextRequest, NextResponse } from "next/server";
import { sandboxService } from "@/langgraph/services";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");

    const content = await sandboxService.readSandboxFile(id, filePath);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Failed to read file from sandbox:", error);
    return NextResponse.json(
      { error: "Failed to read file content" },
      { status: 500 }
    );
  }
} 
