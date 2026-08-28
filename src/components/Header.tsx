export default function Header() {
  return (
    <header className="text-center">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-300">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
        Retrieval-Augmented Generation
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Nimbus<span className="text-accent-400">RAG</span>
      </h1>
      <p className="mt-3 text-base text-ink-400 sm:text-lg">
        Grounded Q&amp;A over the MLSA SRM document set
      </p>
    </header>
  );
}
