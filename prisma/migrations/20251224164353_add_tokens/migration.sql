-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokensRemaining" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "tokensResetAt" TIMESTAMP(3);
