/*
  Warnings:

  - Added the required column `due_date` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "due_date" TIMESTAMP(6) NOT NULL,
ADD COLUMN     "target_class" VARCHAR(50) NOT NULL DEFAULT 'Kelas 10A',
ADD COLUMN     "time_limit" INTEGER NOT NULL DEFAULT 30;
