"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function getUserChats() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return [];
  }

  const chats = await prisma.chat.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return chats;
}
