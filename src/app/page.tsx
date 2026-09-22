export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-3 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          ModuleTracker
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Production tracker for Cornell NanoScale Facility VR training modules.
          Scaffolding in progress.
        </p>
      </main>
    </div>
  );
}
