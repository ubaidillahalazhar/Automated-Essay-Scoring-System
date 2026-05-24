/*
  Warnings:

  - You are about to drop the column `subject` on the `Quiz` table. All the data in the column will be lost.
  - You are about to drop the column `target_class` on the `Quiz` table. All the data in the column will be lost.
  - Added the required column `grade_id` to the `Quiz` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subject_id` to the `Quiz` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Quiz" DROP COLUMN "subject",
DROP COLUMN "target_class",
ADD COLUMN     "grade_id" INTEGER NOT NULL,
ADD COLUMN     "subject_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserDetail" ADD COLUMN     "grade_id" INTEGER;

-- CreateTable
CREATE TABLE "Grade" (
    "grade_id" SERIAL NOT NULL,
    "grade_name" TEXT NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("grade_id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "subject_id" SERIAL NOT NULL,
    "subject_name" TEXT NOT NULL,
    "teacher_id" INTEGER NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_grade_name_key" ON "Grade"("grade_name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_subject_name_teacher_id_key" ON "Subject"("subject_name", "teacher_id");

-- AddForeignKey
ALTER TABLE "UserDetail" ADD CONSTRAINT "UserDetail_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "Grade"("grade_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "Grade"("grade_id") ON DELETE RESTRICT ON UPDATE CASCADE;
