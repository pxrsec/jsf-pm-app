export default function ProtectedLoading() {
  return (
    <div
      className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="h-64 w-full bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
      </main>
    </div>
  );
}
