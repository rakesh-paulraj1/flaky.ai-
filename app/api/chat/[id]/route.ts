import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authentication } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authentication);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: chatId } = await params;
    const { prompt } = await req.json();

    if (!prompt || prompt.length < 1) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }
    const chat = await prisma.chat.findUnique({
      where: { id: chatId, userId: session.user.id },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    await prisma.message.create({
      data: {
        chatId,
        role: "user",
        content: prompt,
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Message saved",
    });
  } catch (error) {
    console.error("Message save error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
