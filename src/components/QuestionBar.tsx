interface Props {
  question: string;
  setQuestion: (q: string) => void;
  onAsk: (q: string) => void;
  loading: boolean;
  examples: string[];
}

export default function QuestionBar({ question, setQuestion, onAsk, loading, examples }: Props) {
  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAsk(question);
          }}
          placeholder="Ask a question about the NimbusNote documents…"
          className="flex-1 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
        />
        <button
          onClick={() => onAsk(question)}
          disabled={loading || !question.trim()}
          className="rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Asking…" : "Ask Question"}
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-500">
          Example questions
        </p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex);
                onAsk(ex);
              }}
              disabled={loading}
              className="rounded-full border border-ink-700 bg-ink-800/50 px-3 py-1.5 text-left text-xs text-ink-300 transition hover:border-accent-500/50 hover:text-accent-200 disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
