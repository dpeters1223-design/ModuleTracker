import type { Metadata } from "next";
import { connection } from "next/server";
import { TasksView } from "./tasks-view";

export const metadata: Metadata = { title: "Tasks · ModuleTracker" };

export default async function TasksPage(props: PageProps<"/tasks">) {
  await connection();
  return <TasksView searchParams={await props.searchParams} />;
}
