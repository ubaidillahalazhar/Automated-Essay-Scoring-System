/*
  Warnings:

  - You are about to drop the column `otp_code` on the `UserDetail` table. All the data in the column will be lost.
  - You are about to drop the column `otp_expires_at` on the `UserDetail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserDetail" DROP COLUMN "otp_code",
DROP COLUMN "otp_expires_at";
