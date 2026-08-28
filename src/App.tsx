import { useState, useCallback } from "react";
import type { RagAnswer } from "./rag/types";
import Header from "./components/Header";
import HowItWorks from "./components/HowItWorks";
import QuestionBar from "./components/QuestionBar";
import AnswerCard from "./components/AnswerCard";
import EvidencePanel from "./components/EvidencePanel";
import LoadingState from "./components/LoadingState";

const EXAMPLE_QUESTIONS = [
  "How often does NimbusNote sync in the background?",
  "What does the Pro plan cost?",
  "How do I reset my password?",
  "What is the capital of France?",
];

// In production (Bolt hosting / Vercel) the API is a Supabase Edge Function.
// In local dev, Vite middleware proxies /api/ask so no key is needed in the browser.
function getApiUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey && import.meta.env.PROD) {
    return `${supabaseUrl}/functions/v1/ask`;
  }
  return "/api/ask";
}

function getApiHeaders(): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey && import.meta.env.PROD) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    };
  }
  return { "Content-Type": "application/json" };
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<RagAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(getApiUrl(), {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data: RagAnswer = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Header />
        <HowItWorks />

        <QuestionBar
          question={question}
          setQuestion={setQuestion}
          onAsk={ask}
          loading={loading}
          examples={EXAMPLE_QUESTIONS}
        />

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && <LoadingState />}

        {!loading && result && (
          <div className="mt-6 space-y-5 animate-fade-up">
            <AnswerCard result={result} />
            <EvidencePanel evidence={result.evidence} answered={result.answered} />
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-ink-500">
          NimbusRAG &middot; MLSA SRM Technical Recruitment Task &middot; Retrieval-Augmented Generation
        </footer>
      </div>
    </div>
  );
}
