/*
  Warnings:

  - Added the required column `school_level` to the `Grade` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "school_level" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserDetail" ADD COLUMN     "teaching_level" TEXT NOT NULL DEFAULT 'SD';
