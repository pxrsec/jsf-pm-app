export default function PmLoading() {
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded" />
      <div className="space-y-4">
        <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-neutral-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
