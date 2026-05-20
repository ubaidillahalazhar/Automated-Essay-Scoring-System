-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_scored_by_fkey";

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "feedback" TEXT,
ALTER COLUMN "scored_by" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_scored_by_fkey" FOREIGN KEY ("scored_by") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
