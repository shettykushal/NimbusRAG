const STEPS = [
  { label: "Question", icon: "?" },
  { label: "Embedding", icon: "E" },
  { label: "Semantic Retrieval", icon: "R" },
  { label: "Relevant Passages", icon: "P" },
  { label: "Grounded Answer", icon: "A" },
];

export default function HowItWorks() {
  return (
    <section className="mt-8 rounded-2xl border border-ink-800 bg-ink-900/40 p-4">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-ink-500">
        How it works
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/60 px-2.5 py-1.5 text-ink-300">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-accent-500/20 text-[10px] font-bold text-accent-300">
                {s.icon}
              </span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-ink-600">&darr;</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
