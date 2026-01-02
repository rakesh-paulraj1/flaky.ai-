import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authentication } from "@/app/api/auth/[...nextauth]/route";
import { sandboxService } from "@/langgraph/services";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authentication);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Close sandbox
    await sandboxService.closeSandbox(id);
    
    return NextResponse.json({ success: true, message: "Sandbox closed" });
  } catch (error) {
    console.error("Failed to close sandbox:", error);
    return NextResponse.json(
      { error: "Failed to close sandbox" },
      { status: 500 }
    );
  }
}
