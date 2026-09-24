"use server";

import { changed } from "@/lib/changed";
import type { TaskPhase, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TASK_PHASE_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";

export type TaskInput = {
  title: string;
  phase: string;
  owner: string;
  status: string;
  startDate: string; // "YYYY-MM-DD" or ""
  dueDate: string;
  notes: string;
};

export type TaskResult = { errors?: string[] };

// Dates are calendar days: store at noon UTC so no timezone shifts them a day.
const toDate = (s: string) => (s ? new Date(`${s}T12:00:00Z`) : null);

function validate(input: TaskInput) {
  const t = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const data = {
    title: t(input.title),
    phase: t(input.phase),
    owner: t(input.owner),
    status: t(input.status),
    startDate: t(input.startDate),
    dueDate: t(input.dueDate),
    notes: t(input.notes),
  };
  const errors: string[] = [];
  if (!data.title) errors.push("Task name is required.");
  if (data.title.length > 200 || data.owner.length > 100 || data.notes.length > 5000) {
    errors.push("Some entries are too long.");
  }
  if (!(data.phase in TASK_PHASE_LABELS)) errors.push("Pick a phase.");
  if (!(data.status in TASK_STATUS_LABELS)) errors.push("Pick a status.");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  for (const d of [data.startDate, data.dueDate]) {
    if (d && (!dateRe.test(d) || isNaN(Date.parse(d)))) errors.push("Dates must be valid dates.");
  }
  if (data.startDate && data.dueDate && data.dueDate < data.startDate) {
    errors.push("The due date is before the start date.");
  }
  return {
    errors,
    fields: {
      title: data.title,
      phase: data.phase as TaskPhase,
      owner: data.owner || null,
      status: data.status as TaskStatus,
      startDate: toDate(data.startDate),
      dueDate: toDate(data.dueDate),
      notes: data.notes || null,
    },
  };
}

export async function createTask(moduleId: string, input: TaskInput): Promise<TaskResult> {
  await requireUser();
  const { errors, fields } = validate(input);
  if (errors.length) return { errors };

  const last = await prisma.task.findFirst({
    where: { moduleId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.task.create({ data: { moduleId, order: (last?.order ?? 0) + 1, ...fields } });
  changed();
  return {};
}

export async function updateTask(
  moduleId: string,
  taskId: string,
  input: TaskInput
): Promise<TaskResult> {
  await requireUser();
  const { errors, fields } = validate(input);
  if (errors.length) return { errors };
  await prisma.task.updateMany({ where: { id: taskId, moduleId }, data: fields });
  changed();
  return {};
}

/** Quick status change from the task row. */
export async function setTaskStatus(
  moduleId: string,
  taskId: string,
  status: string
): Promise<TaskResult> {
  await requireUser();
  if (!(status in TASK_STATUS_LABELS)) return { errors: ["Unknown status."] };
  await prisma.task.updateMany({
    where: { id: taskId, moduleId },
    data: { status: status as TaskStatus },
  });
  changed();
  return {};
}

/** Moves a task to another phase (the board's column picker). */
export async function setTaskPhase(
  moduleId: string,
  taskId: string,
  phase: string
): Promise<TaskResult> {
  await requireUser();
  if (!(phase in TASK_PHASE_LABELS)) return { errors: ["Unknown phase."] };
  await prisma.task.updateMany({
    where: { id: taskId, moduleId },
    data: { phase: phase as TaskPhase },
  });
  changed();
  return {};
}

export async function deleteTask(moduleId: string, taskId: string): Promise<TaskResult> {
  await requireUser();
  await prisma.task.deleteMany({ where: { id: taskId, moduleId } });
  changed();
  return {};
}
