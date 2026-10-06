import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser } from "@/lib/session";
import { TasksView } from "../tasks/tasks-view";

export const metadata: Metadata = { title: "My tasks · ModuleTracker" };

export default async function MyTasksPage(props: PageProps<"/my-tasks">) {
  await connection();
  const user = await requireUser();
  return <TasksView searchParams={await props.searchParams} mine={user.email} />;
}
