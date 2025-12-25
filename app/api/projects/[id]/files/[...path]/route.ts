import { NextRequest, NextResponse } from "next/server";
import { sandboxService } from "@/lib/services";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");

    const sandbox = await sandboxService.getSandbox(id);

    let content = "";
    const possiblePaths = [
      path.join("/home/user/react-app", filePath),
      path.join("/home/user", filePath),
      filePath.startsWith("/") ? filePath : `/${filePath}`,
    ];

    let found = false;
    for (const p of possiblePaths) {
      try {
        content = await sandbox.files.read(p);
        found = true;
        break;
      } catch {
        continue;
      }
    }

    if (!found) {
      return NextResponse.json(
        { error: `File not found in sandbox: ${filePath}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Failed to read file from sandbox:", error);
    return NextResponse.json(
      { error: "Failed to read file content" },
      { status: 500 }
    );
  }
}
