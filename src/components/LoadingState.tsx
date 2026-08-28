export default function LoadingState() {
  return (
    <div className="mt-6 space-y-4 animate-fade-up">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5">
        <div className="mb-3 h-3 w-24 rounded bg-ink-700/70" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-ink-800/70" />
          <div className="h-3 w-4/5 rounded bg-ink-800/70" />
          <div className="h-3 w-2/3 rounded bg-ink-800/70" />
        </div>
        <p className="mt-4 text-xs text-accent-300">
          Embedding question &amp; retrieving passages…
        </p>
      </div>
    </div>
  );
}
