-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_priority" BOOLEAN NOT NULL DEFAULT false,
    "preference_order" INTEGER NOT NULL,
    "assignment_run_id" UUID,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parallel" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 42,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotteries" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "course_name" TEXT NOT NULL,
    "parallel" INTEGER NOT NULL,
    "preference" INTEGER NOT NULL,
    "candidates" INTEGER NOT NULL,
    "available_spots" INTEGER NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignment_run_id" UUID,

    CONSTRAINT "lotteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lottery_results" (
    "id" UUID NOT NULL,
    "lottery_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "student_email" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL,
    "request_ip" TEXT,
    "user_agent" TEXT,
    "execution_context" JSONB,

    CONSTRAINT "lottery_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_runs" (
    "id" UUID NOT NULL,
    "initiated_by" UUID,
    "initiated_by_email" TEXT,
    "seed" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_logs" (
    "id" UUID NOT NULL,
    "assignment_run_id" UUID,
    "event_type" TEXT NOT NULL,
    "event_subtype" TEXT,
    "student_id" UUID,
    "student_email" TEXT,
    "course_id" UUID,
    "course_name" TEXT,
    "parallel" INTEGER,
    "preference" INTEGER,
    "is_priority" BOOLEAN,
    "details" JSONB,
    "request_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selections" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "preference_order" INTEGER NOT NULL,

    CONSTRAINT "selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "is_neurodivergent" BOOLEAN NOT NULL,
    "previous_electives" TEXT[],
    "role" TEXT NOT NULL DEFAULT 'student',

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignments_student_id_course_id_key" ON "assignments"("student_id", "course_id");

-- CreateIndex
CREATE INDEX "assignment_logs_assignment_run_id_idx" ON "assignment_logs"("assignment_run_id");

-- CreateIndex
CREATE INDEX "assignment_logs_student_id_idx" ON "assignment_logs"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assignment_run_id_fkey" FOREIGN KEY ("assignment_run_id") REFERENCES "assignment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_assignment_run_id_fkey" FOREIGN KEY ("assignment_run_id") REFERENCES "assignment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_results" ADD CONSTRAINT "lottery_results_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_assignment_run_id_fkey" FOREIGN KEY ("assignment_run_id") REFERENCES "assignment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
