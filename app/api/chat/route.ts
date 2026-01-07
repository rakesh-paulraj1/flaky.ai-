import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authentication } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";


export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authentication);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt } = await req.json();
    if (!prompt || prompt.length < 3) {
      return NextResponse.json(
        { error: "Too short or no description" },
        { status: 400 }
      );
    }
    const chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: prompt.length > 100 ? prompt.substring(0, 100) : prompt,
      },
    });

    await prisma.message.create({
      data:{
       role:"user",
       chatId:chat.id,
       content:prompt
      }
    })

    
    return NextResponse.json({
      status: "success",
      message: `Agent started for project ${chat.id}.`,
      chat_id: chat.id
    });
  } catch (error) {
    console.error("Chat creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
