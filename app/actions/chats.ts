"use server";

import prisma from "@/lib/prisma";
import type { Message } from "@/lib/chat-types";

export async function getChatMessages(chatId: string): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: { chatId: chatId },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    created_at: msg.createdAt.toISOString(),
  }));
}
