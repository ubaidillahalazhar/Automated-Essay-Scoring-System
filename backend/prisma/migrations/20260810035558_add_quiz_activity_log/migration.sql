-- CreateTable
CREATE TABLE "QuizActivityLog" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizActivityLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE INDEX "QuizActivityLog_quiz_id_created_at_idx" ON "QuizActivityLog"("quiz_id", "created_at");

-- CreateIndex
CREATE INDEX "QuizActivityLog_user_id_created_at_idx" ON "QuizActivityLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "QuizActivityLog_event_type_idx" ON "QuizActivityLog"("event_type");

-- AddForeignKey
ALTER TABLE "QuizActivityLog" ADD CONSTRAINT "QuizActivityLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizActivityLog" ADD CONSTRAINT "QuizActivityLog_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "Quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;
