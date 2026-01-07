/*
  Warnings:

  - You are about to drop the `Brand` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Creative` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Brand" DROP CONSTRAINT "Brand_userId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_brandId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_chatId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_productId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_userId_fkey";

-- DropForeignKey
ALTER TABLE "Creative" DROP CONSTRAINT "Creative_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "Creative" DROP CONSTRAINT "Creative_productId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_brandId_fkey";

-- DropTable
DROP TABLE "Brand";

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "Creative";

-- DropTable
DROP TABLE "Product";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "imageLinks" TEXT[],
    "ctalink" TEXT NOT NULL,
    "productDetails" TEXT NOT NULL,
    "videoGenerationEntities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_chatId_key" ON "Project"("chatId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
