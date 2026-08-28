import type { RagAnswer } from "../rag/types";

interface Props {
  result: RagAnswer;
}

export default function AnswerCard({ result }: Props) {
  const notAnswered = !result.answered;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        notAnswered
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-accent-500/30 bg-accent-500/5"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            notAnswered ? "bg-amber-500/20 text-amber-300" : "bg-accent-500/20 text-accent-300"
          }`}
        >
          {notAnswered ? "!" : "A"}
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
          {notAnswered ? "No reliable answer found" : "Answer"}
        </h2>
      </div>

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-100">
        {result.answer}
      </p>

      {notAnswered && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          {result.reason}
        </p>
      )}

      {result.answered && (
        <p className="mt-3 text-xs text-ink-500">{result.reason}</p>
      )}

      {!result.llmConfigured && result.answered && (
        <p className="mt-2 text-xs text-amber-300/80">
          OpenAI key not configured on server — answer generation skipped. Retrieval still ran (see evidence below).
        </p>
      )}
    </div>
  );
}
