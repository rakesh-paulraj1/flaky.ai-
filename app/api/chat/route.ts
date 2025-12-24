import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const activeRuns = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt } = await req.json();
    if (!prompt || prompt.length < 3) {
      return NextResponse.json(
        { error: "Too short or no description" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chatId = uuidv4();

    if (activeRuns.has(chatId)) {
      return NextResponse.json(
        { error: "Project is being created. Kindly wait" },
        { status: 400 }
      );
    }


    await prisma.chat.create({
      data: {
        id: chatId,
        userId: user.id,
        title: prompt.length > 100 ? prompt.substring(0, 100) : prompt,
      },
    });



    

    return NextResponse.json({
      status: "success",
      message: `Agent started for project ${chatId}.`,
      chat_id: chatId,
    });
  } catch (error) {
    console.error("Chat creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
