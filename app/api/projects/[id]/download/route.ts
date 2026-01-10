import { NextRequest, NextResponse } from "next/server";
import { sandboxService } from "@/langgraph/services";
import prisma from "@/lib/prisma";
import JSZip from "jszip";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { chatId: true, productName: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sandbox = await sandboxService.getSandbox(project.chatId);
    const files = await sandboxService.getSandboxFiles(project.chatId);

    const zip = new JSZip();

    for (const filePath of files) {
      try {
        const content = await sandbox.files.read(
          `/home/user/react-app/${filePath}`
        );
        zip.file(filePath, content);
      } catch (err) {
        console.error(`Failed to read file ${filePath}:`, err);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const sanitizedName = project.productName
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizedName}-files.zip"`,
      },
    });
  } catch (error) {
    console.error("Failed to download files:", error);
    return NextResponse.json(
      { error: "Failed to download files" },
      { status: 500 }
    );
  }
}
