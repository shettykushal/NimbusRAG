import { useState } from "react";
import type { RetrievalResult } from "../rag/types";

interface Props {
  evidence: RetrievalResult[];
  answered: boolean;
}

function scoreColor(score: number): string {
  if (score >= 0.6) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
  if (score >= 0.45) return "text-accent-300 bg-accent-500/15 border-accent-500/30";
  return "text-amber-300 bg-amber-500/10 border-amber-500/30";
}

function EvidenceItem({ item, index }: { item: RetrievalResult; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-ink-800/40"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-800 text-[10px] font-bold text-ink-400">
            {index + 1}
          </span>
          <span className="truncate font-mono text-xs text-ink-300">
            {item.filename}
          </span>
          <span className="hidden sm:inline truncate text-xs text-ink-500">
            &middot; {item.section}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${scoreColor(
              item.score,
            )}`}
          >
            {item.score.toFixed(3)}
          </span>
          <span className="text-ink-600 text-xs">{open ? "−" : "+"}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-ink-800 px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500">
            <span>
              <span className="text-ink-600">Source:</span>{" "}
              <span className="font-mono text-ink-400">{item.filename}</span>
            </span>
            <span>
              <span className="text-ink-600">Section:</span>{" "}
              <span className="text-ink-400">{item.section}</span>
            </span>
            <span>
              <span className="text-ink-600">Chunk:</span>{" "}
              <span className="text-ink-400">#{item.chunkIndex}</span>
            </span>
          </div>
          <p className="whitespace-pre-wrap rounded-lg bg-ink-950/60 p-3 text-xs leading-relaxed text-ink-300 font-mono scroll-thin max-h-48 overflow-y-auto">
            {item.text}
          </p>
        </div>
      )}
    </div>
  );
}

export default function EvidencePanel({ evidence, answered }: Props) {
  if (evidence.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-ink-400">
          R
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          Retrieved Evidence
        </h2>
        <span className="text-xs text-ink-600">
          top {evidence.length} by cosine similarity
        </span>
      </div>

      {!answered && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
          No retrieved passage exceeded the relevance threshold, so the LLM was not called.
        </p>
      )}

      <div className="space-y-2.5">
        {evidence.map((item, i) => (
          <EvidenceItem key={`${item.filename}-${item.chunkIndex}`} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}
