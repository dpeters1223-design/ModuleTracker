-- AlterEnum
-- Hand-positioned (Prisma's own diff just appends the new value at the end;
-- BEFORE keeps TaskStatus in the same pipeline order as schema.prisma: not_started,
-- in_progress, feedback_submitted, delayed, completed).
ALTER TYPE "TaskStatus" ADD VALUE 'feedback_submitted' BEFORE 'delayed';
