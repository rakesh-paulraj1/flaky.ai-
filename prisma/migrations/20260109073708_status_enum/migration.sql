-- CreateEnum
CREATE TYPE "ProjectState" AS ENUM ('INITIAL', 'CREATIVE', 'DEPLOYED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "state" "ProjectState" NOT NULL DEFAULT 'INITIAL';
