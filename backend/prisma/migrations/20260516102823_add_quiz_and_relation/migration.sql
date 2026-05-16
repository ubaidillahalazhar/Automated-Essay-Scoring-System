/*
  Warnings:

  - You are about to drop the column `created_by` on the `EssayQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `EssayQuestion` table. All the data in the column will be lost.
  - Added the required column `quiz_id` to the `EssayQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EssayQuestion" DROP CONSTRAINT "EssayQuestion_created_by_fkey";

-- AlterTable
ALTER TABLE "EssayQuestion" DROP COLUMN "created_by",
DROP COLUMN "subject",
ADD COLUMN     "quiz_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Quiz" (
    "quiz_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "subject" VARCHAR(255) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("quiz_id")
);

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayQuestion" ADD CONSTRAINT "EssayQuestion_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "Quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;
