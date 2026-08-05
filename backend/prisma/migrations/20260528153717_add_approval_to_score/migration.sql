-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "is_approved" BOOLEAN NOT NULL DEFAULT false;
