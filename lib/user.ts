import prisma from "./prisma";

export async function canMakeQuery(userEmail: string): Promise<boolean> {
  if (userEmail === "grabhaymishra@gmail.com") return true;

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) return false;

  const now = new Date();

  // Check if we need to reset tokens (24 hours passed)
  if (!user.tokensResetAt || now >= user.tokensResetAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tokensRemaining: 2,
        tokensResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    return true;
  }

  return user.tokensRemaining > 0;
}

export async function consumeToken(userEmail: string): Promise<boolean> {
  if (userEmail === "grabhaymishra@gmail.com") return true;

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) return false;

  const now = new Date();

  // Reset check (same as canMakeQuery but updates just in case)
  if (!user.tokensResetAt || now >= user.tokensResetAt) {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        tokensRemaining: 2,
        tokensResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (updatedUser.tokensRemaining > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          tokensRemaining: updatedUser.tokensRemaining - 1,
          lastQueryAt: now,
        },
      });
      return true;
    }
    return false;
  }

  if (user.tokensRemaining > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tokensRemaining: user.tokensRemaining - 1,
        lastQueryAt: now,
      },
    });
    return true;
  }

  return false;
}

export function getTimeUntilReset(tokensResetAt: Date | null): number {
  if (!tokensResetAt) return 0;
  const now = new Date();
  const diff = tokensResetAt.getTime() - now.getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
}
