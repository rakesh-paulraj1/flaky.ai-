"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function getUserProjcets() {
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

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return projects;
}

export async function getProjectwithid(projectid:string){
  const project = await prisma.project.findUnique({
    where: { id: projectid },
  });
  return project;
}
