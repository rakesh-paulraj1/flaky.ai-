import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authentication } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authentication);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Missing chat ID" }, { status: 400 });
  }

  const messages = await prisma.message.findMany({
    where: { chatId},
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    created_at: msg.createdAt.toISOString(),
  })));
}