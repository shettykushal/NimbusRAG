// NimbusRAG — serverless Q&A edge function.
//
// This is the production API endpoint for the RAG pipeline. It runs the same
// algorithm as the local dev middleware: load docs → chunk → embed query →
// cosine similarity → top-3 → threshold → grounded LLM answer.
//
// The OpenAI key is read from the OPENAI_API_KEY edge-function secret and is
// never exposed to the browser. The function is self-contained (no shared
// code with the frontend) because edge functions cannot import app source.
//
// CORS headers are mandatory on every response.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// --- Document corpus (the three official MLSA SRM starter documents) -------

const DOCUMENTS: { filename: string; text: string }[] = [
  {
    filename: "01-getting-started.md",
    text: `# NimbusNote — Getting Started
NimbusNote is a lightweight note-syncing service used internally for this exercise. It is fictional — do not look for a real product by this name.
## Creating a workspace
Every user starts by creating a workspace. A workspace is identified by a lowercase slug (letters, numbers, and hyphens only) and can hold up to 50 notebooks on the Free plan, or unlimited notebooks on the Pro plan.
To create a workspace, send a \`POST /workspaces\` request with a \`name\` field. The server responds with a \`workspace\\_id\` that you'll use in every subsequent request.
## Creating your first note
Notes belong to notebooks, and notebooks belong to workspaces. A brand-new workspace automatically gets one notebook called "Inbox". You can create a note directly inside Inbox with \`POST /notebooks/{id}/notes\`.
Notes support Markdown formatting. Images are not supported in the Free plan; Pro plan workspaces can attach up to 20MB of images per note.
## Sync behavior
NimbusNote syncs every 15 seconds while the app is in the foreground, and every 5 minutes in the background. If two devices edit the same note within that sync window, NimbusNote keeps both versions as separate note revisions rather than silently merging them — the user is asked to pick which version to keep the next time they open the note.
## Offline mode
All notes are available offline once they've synced at least once. Notes created while offline are queued and sync automatically once the connection returns. There is no limit to how long a note can stay queued offline.`,
  },
  {
    filename: "02-pricing-and-plans.md",
    text: `# NimbusNote — Pricing and Plans
NimbusNote offers three plans: Free, Pro, and Team.
## Free plan
- Up to 50 notebooks per workspace
- 5 collaborators per workspace
- No image attachments
- 30-day note history
## Pro plan — $6/month per workspace
- Unlimited notebooks
- 20 collaborators per workspace
- Image attachments up to 20MB per note
- Unlimited note history
- Priority sync (every 5 seconds instead of 15)
## Team plan — $10/month per seat
- Everything in Pro
- Unlimited collaborators
- Admin controls: enforce SSO, audit log, workspace-wide export
- A dedicated support channel with a 4-hour response SLA on business days
## Switching plans
You can upgrade or downgrade at any time from the workspace settings page. Upgrades take effect immediately. Downgrades take effect at the end of the current billing cycle — you keep Pro/Team features until then, and NimbusNote will warn you if you're using something (like more than 50 notebooks) that won't fit on the plan you're downgrading to.
## Refunds
NimbusNote does not offer prorated refunds for early cancellation. If you cancel Team or Pro mid-cycle, you keep access until the cycle ends, and you are not billed again.
## Student discount
Workspaces verified as belonging to a student (via a \`.edu\` email or equivalent) get 50% off the Pro plan. There is currently no student discount on the Team plan.`,
  },
  {
    filename: "03-troubleshooting.md",
    text: `# NimbusNote — Troubleshooting
## "My note didn't sync"
First check the sync indicator in the top-right corner of the app. A grey cloud icon means the note is queued but hasn't synced yet — this is normal if you're offline. A red cloud icon means sync failed after retrying, and usually means your session has expired; sign out and back in to fix it.
If the icon is green but changes still aren't showing on your other device, it's almost always because the other device is more than 5 minutes stale in the background — bring the app to the foreground on that device to force an immediate sync.
## "I see two versions of the same note"
This happens when the same note was edited on two devices within the same sync window (see the Getting Started guide for how sync timing works). NimbusNote does not auto-merge conflicting edits. Open the note and use the "Compare versions" button to manually pick which version to keep, or keep both as separate notes.
## "I can't upload an image"
Image attachments are a Pro and Team plan feature only. If you're on the Free plan, uploading an image will show an upgrade prompt instead of an error. If you're on Pro or Team and still can't upload, check that the image is under the 20MB limit — larger files fail silently in the current app version, which is a known issue on the roadmap to fix.
## "My workspace says it's over its notebook limit"
This happens only on the Free plan (50 notebook cap) after a downgrade from Pro or Team. You won't lose any notebooks, but you won't be able to create new ones until you're back under the limit or you upgrade again.
## Account recovery
If you're locked out, use the "Forgot password" link on the sign-in page. Password reset emails expire after 1 hour. There is currently no SMS-based recovery option.`,
  },
];

// --- Chunking (by Markdown headings, same as the app chunker) --------------

interface Chunk {
  filename: string;
  section: string;
  chunkIndex: number;
  text: string;
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;

function chunkDocument(doc: { filename: string; text: string }): Chunk[] {
  const lines = doc.text.split("\n");
  const chunks: Chunk[] = [];
  let currentSection = "";
  let buffer: string[] = [];

  const flush = (section: string) => {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        filename: doc.filename,
        section: section || "Untitled",
        chunkIndex: 0,
        text,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      flush(currentSection);
      currentSection = m[2].trim();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush(currentSection);

  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}

// --- Cosine similarity (same implementation as the app retriever) ---------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// --- Embedding + generation via OpenAI --------------------------------------

async function embed(texts: string[], apiKey: string, model: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.data
    .slice()
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

const SYSTEM_PROMPT = `You are a document-grounded question answering assistant.

Answer ONLY using the supplied context.
Do not use outside knowledge.
Do not invent information.
If the context does not contain enough information to answer the question, say that the information is not available in the provided documents.
Keep answers concise.
Identify the source passage used for the answer.`;

async function generateAnswer(
  question: string,
  evidence: { filename: string; section: string; score: number; text: string }[],
  apiKey: string,
  model: string,
): Promise<string> {
  const context = evidence
    .map(
      (r, i) =>
        `[Passage ${i + 1}] Source: ${r.filename}\nSection: ${r.section}\nSimilarity: ${r.score.toFixed(2)}\n"${r.text}"`,
    )
    .join("\n\n");

  const userPrompt = `Context passages retrieved from the document set:

${context}

Question: ${question}

Answer the question using ONLY the context above. Cite the source filename and section you used.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI chat error (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.choices[0]?.message?.content?.trim() ?? "";
}

// --- Response shape (matches src/rag/types.ts RagAnswer) -------------------

interface RetrievalResult {
  filename: string;
  section: string;
  chunkIndex: number;
  text: string;
  score: number;
}

interface RagAnswer {
  answered: boolean;
  answer: string;
  evidence: RetrievalResult[];
  reason: string;
  llmConfigured: boolean;
}

// --- Handler ---------------------------------------------------------------

const TOP_K = 3;
const DEFAULT_THRESHOLD = 0.45;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const question = (body?.question ?? "").toString().trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const embeddingModel = Deno.env.get("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
    const chatModel = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini";
    const threshold = parseFloat(Deno.env.get("RELEVANCE_THRESHOLD") ?? "0.45");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not configured. Add it as an edge function secret.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Chunk the corpus.
    const chunks: Chunk[] = DOCUMENTS.flatMap(chunkDocument);

    // 2. Embed all chunks + the query in one call.
    const allTexts = [...chunks.map((c) => c.text), question];
    const allVectors = await embed(allTexts, apiKey, embeddingModel);
    const queryVec = allVectors[allVectors.length - 1];
    const chunkVecs = allVectors.slice(0, chunks.length);

    // 3. Cosine similarity + top-k.
    const scored: RetrievalResult[] = chunks.map((c, i) => ({
      filename: c.filename,
      section: c.section,
      chunkIndex: c.chunkIndex,
      text: c.text,
      score: cosineSimilarity(queryVec, chunkVecs[i]),
    }));
    scored.sort((a, b) => b.score - a.score);
    const evidence = scored.slice(0, TOP_K);
    const relevant = evidence.filter((r) => r.score >= threshold);

    // 4. Threshold gate: no relevant chunk → do NOT call the LLM.
    if (relevant.length === 0) {
      const result: RagAnswer = {
        answered: false,
        answer:
          "I couldn't find enough information in the provided documents to answer this question.",
        evidence,
        reason: "No retrieved passage exceeded the relevance threshold.",
        llmConfigured: false,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Grounded answer from the LLM.
    const answer = await generateAnswer(question, relevant, apiKey, chatModel);
    const result: RagAnswer = {
      answered: true,
      answer,
      evidence,
      reason: `${relevant.length} passage(s) exceeded the relevance threshold of ${threshold}.`,
      llmConfigured: true,
    };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error during RAG pipeline",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
