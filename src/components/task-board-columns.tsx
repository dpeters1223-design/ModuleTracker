"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { TaskPhase } from "@prisma/client";
import { TASK_PHASE_LABELS } from "@/lib/labels";
import { PHASE_COLORS } from "@/lib/phase-colors";
import { formatDay } from "@/lib/task-format";
import { TaskPhaseSelect, TaskStatusSelect } from "@/components/task-status";
import { createTask, setTaskPhase } from "@/app/modules/[id]/task-actions";

export type BoardTask = {
  id: string;
  moduleId: string;
  title: string;
  phase: string;
  status: string;
  owner: string | null;
  due: string; // "YYYY-MM-DD" or ""
};

const PHASES = Object.keys(TASK_PHASE_LABELS) as TaskPhase[];

/** Stops pointer/key events on controls inside a card from starting a drag. */
const noDrag = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

function CardBody({ task, today }: { task: BoardTask; today: string }) {
  const late = task.status !== "completed" && !!task.due && task.due < today;
  return (
    <>
      <p className={`text-sm ${task.status === "completed" ? "text-zinc-400 line-through" : "font-medium"}`}>
        {task.title}
      </p>
      {(task.owner || task.due) && (
        <p className="text-xs text-zinc-500">
          {[task.owner, task.due && `Due ${formatDay(task.due, today)}`].filter(Boolean).join(" · ")}
          {late && <span className="ml-1 font-medium text-red-700 dark:text-red-400">Overdue</span>}
        </p>
      )}
    </>
  );
}

const cardCls =
  "space-y-1.5 rounded-md border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

function DraggableCard({ task, today }: { task: BoardTask; today: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      className={`${cardCls} cursor-grab touch-manipulation active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <CardBody task={task} today={today} />
      <div className="flex flex-wrap items-center gap-1.5" {...noDrag}>
        <TaskStatusSelect moduleId={task.moduleId} taskId={task.id} title={task.title} status={task.status} />
        <TaskPhaseSelect moduleId={task.moduleId} taskId={task.id} title={task.title} phase={task.phase} />
      </div>
    </li>
  );
}

function QuickAdd({ moduleId, phase, onDone }: { moduleId: string; phase: TaskPhase; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return onDone();
        startTransition(async () => {
          const res = await createTask(moduleId, {
            title,
            phase,
            owner: "",
            status: "not_started",
            startDate: "",
            dueDate: "",
            notes: "",
          });
          if (res.errors?.length) return setError(res.errors[0]);
          onDone();
        });
      }}
    >
      <input
        autoFocus
        aria-label={`New ${TASK_PHASE_LABELS[phase]} task`}
        placeholder="Task name, then Enter"
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        value={title}
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        onBlur={() => !title.trim() && onDone()}
      />
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </form>
  );
}

function Column({
  moduleId,
  phase,
  tasks,
  today,
}: {
  moduleId: string;
  phase: TaskPhase;
  tasks: BoardTask[];
  today: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: phase });
  const [adding, setAdding] = useState(false);
  return (
    <div
      ref={setNodeRef}
      className={`flex w-52 shrink-0 flex-col rounded-lg border-t-4 bg-zinc-100 p-2 transition dark:bg-zinc-900 ${
        isOver ? "ring-2 ring-teal" : ""
      }`}
      style={{ borderTopColor: PHASE_COLORS[phase] }}
    >
      <h3 className="flex items-center justify-between gap-1 px-1 pb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[phase] }} />
          {TASK_PHASE_LABELS[phase]}
        </span>
        <span className="flex items-center gap-1 font-normal text-zinc-500">
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add a ${TASK_PHASE_LABELS[phase]} task`}
            title={`Add a ${TASK_PHASE_LABELS[phase]} task`}
            className="flex h-5 w-5 items-center justify-center rounded text-sm leading-none text-zinc-500 hover:bg-white hover:text-brand dark:hover:bg-zinc-800 dark:hover:text-gold"
          >
            +
          </button>
          <span className="min-w-3 text-right">{tasks.length || ""}</span>
        </span>
      </h3>
      {adding && (
        <div className="pb-2">
          <QuickAdd moduleId={moduleId} phase={phase} onDone={() => setAdding(false)} />
        </div>
      )}
      {/* About three cards tall; more scroll inside the column. */}
      <ul className="max-h-[19.5rem] space-y-2 overflow-y-auto pr-0.5">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} today={today} />
        ))}
      </ul>
    </div>
  );
}

/** One module's tasks in phase columns; drag a card to another column to change its phase. */
export function TaskBoardColumns({
  moduleId,
  tasks,
  today,
}: {
  moduleId: string;
  tasks: BoardTask[];
  today: string;
}) {
  const [shown, move] = useOptimistic(tasks, (state, m: { id: string; phase: string }) =>
    state.map((t) => (t.id === m.id ? { ...t, phase: m.phase } : t))
  );
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold on touch, so swiping still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const task = shown.find((t) => t.id === active.id);
    const phase = over?.id as string | undefined;
    if (!task || !phase || task.phase === phase) return;
    setError("");
    startTransition(async () => {
      move({ id: task.id, phase });
      const res = await setTaskPhase(moduleId, task.id, phase);
      if (res.errors?.length) setError(res.errors[0]);
    });
  };

  const active = shown.find((t) => t.id === activeId);
  return (
    <DndContext
      id={`board-${moduleId}`}
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      {error && <p className="pb-1 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {PHASES.map((phase) => (
          <Column
            key={phase}
            moduleId={moduleId}
            phase={phase}
            tasks={shown.filter((t) => t.phase === phase)}
            today={today}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className={`${cardCls} w-48 rotate-2 cursor-grabbing shadow-lg`}>
            <CardBody task={active} today={today} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
