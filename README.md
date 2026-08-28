# NimbusRAG — Grounded Document Q&A

NimbusRAG is a Retrieval-Augmented Generation (RAG) question-answering app built for the **MLSA SRM Technical Recruitment Task**. It answers questions about the fictional NimbusNote product using *only* the three official starter documents — it never sends a question straight to the LLM.

> This is **not** a chatbot. Every answer is grounded in passages that are semantically retrieved from the document set first, then handed to the LLM with citations.

---

## 1. Project overview

NimbusRAG lets a user ask a natural-language question about NimbusNote and returns a concise, cited answer. The UI shows the **retrieved evidence** — the actual document chunks and their similarity scores — alongside the answer, so a reviewer can verify that genuine retrieval happened before generation.

The knowledge base is the official MLSA SRM starter corpus:

- `01-getting-started.md`
- `02-pricing-and-plans.md`
- `03-troubleshooting.md`

from [MLSA-SRM/recruit-task-rag-docs](https://github.com/MLSA-SRM/recruit-task-rag-docs).

## 2. MLSA task requirement

The task asks for a RAG mini Q&A bot that:

1. Loads the provided documents.
2. Splits them into meaningful chunks with metadata (filename, section, chunk number, original text).
3. Embeds every chunk.
4. On a question, embeds it and computes cosine similarity against all chunks.
5. Retrieves the top-3 chunks.
6. Sends **only** the retrieved context to the LLM for a grounded answer.
7. Refuses to answer when nothing clears a relevance threshold (no hallucination).
8. Shows citations: source file, section, similarity score, retrieved passage.

NimbusRAG implements every one of these requirements.

## 3. Architecture

```
Browser (React + Tailwind)
   │  POST /api/ask { question }        (dev: Vite middleware)
   │  POST /functions/v1/ask { question } (prod: Supabase Edge Function)
   ▼
Server-side API  ──►  holds OPENAI_API_KEY (never reaches browser)
   │
   ▼
RAG pipeline:  chunk → embed query → cosine similarity → top-3 → threshold → grounded LLM answer
```

- **Frontend**: React + TypeScript + Tailwind CSS, built with Vite.
- **Backend (production)**: a Supabase Edge Function (`supabase/functions/ask/index.ts`) that runs the full RAG pipeline server-side. The OpenAI key is stored as an edge function secret and is never exposed to the browser.
- **Backend (local dev)**: a Vite dev middleware (`api/ask.ts`) that runs the same RAG pipeline so you can develop without deploying. The frontend automatically calls `/api/ask` in dev and the edge function in production.
- **Vector store**: in-memory. The corpus is embedded once on first request and cached for the process lifetime. No external vector database.

### Project structure

```
nimbus-rag/
├── api/
│   └── ask.ts              # local dev API route (Vite middleware, keeps the key secret)
├── supabase/
│   ├── config.toml          # edge function config (verify_jwt = false for public API)
│   └── functions/ask/
│       └── index.ts        # production serverless API (Supabase Edge Function)
├── data/documents/         # the three official MLSA documents
├── src/
│   ├── rag/
│   │   ├── types.ts        # shared types (Chunk, RetrievalResult, RagAnswer…)
│   │   ├── loader.ts       # loads the Markdown documents
│   │   ├── chunker.ts      # splits by Markdown headings → chunks + metadata
│   │   ├── embeddings.ts   # OpenAI embeddings (injectable Embedder interface)
│   │   ├── retriever.ts    # cosine similarity + top-k retrieval + threshold
│   │   ├── generator.ts    # grounded answer generation with strict prompt
│   │   ├── rag.ts          # orchestrator + in-memory vector store
│   │   └── index.ts        # public exports
│   ├── components/         # React UI components
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/                  # vitest tests (cosine, retrieval, metadata, rejection, API shape)
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

## 4. How RAG works

RAG stands for **Retrieval-Augmented Generation**. Instead of asking an LLM a question directly (which can hallucinate), we first **retrieve** the most relevant passages from a trusted document set, then ask the LLM to answer **only** from those passages.

```
Question
  ↓
Embedding
  ↓
Semantic Retrieval (cosine similarity vs all chunks)
  ↓
Relevant Passages (top 3)
  ↓
Grounded Answer (LLM sees only the retrieved context)
```

## 5. Document ingestion

At startup, `loader.ts` loads the three Markdown documents bundled with the app. They are imported as raw strings at build time, so the server needs no filesystem access — the corpus is self-contained.

## 6. Chunking

`chunker.ts` splits each document by its Markdown headings (`##`, `###`, and the `#` title). Each chunk is one heading + its body text, and keeps:

- `filename` — the source `.md` file
- `section` — the heading text (e.g. "Sync behavior")
- `chunkIndex` — 0-based position within the document
- `text` — the original passage

Heading-based chunking makes citations meaningful: "Section: Sync behavior" maps to a real heading in the document.

## 7. Embeddings

`embeddings.ts` calls the OpenAI embeddings API (`text-embedding-3-small` by default) to turn each chunk and each question into a vector. The `Embedder` interface is injectable, so tests use a deterministic fake embedder with no network access.

## 8. Cosine similarity

`retriever.ts` implements cosine similarity explicitly:

```
sim(a, b) = (a · b) / (‖a‖ × ‖b‖)
```

No external vector library is used — the math is a simple loop over the vector components, so it's easy to explain in a walkthrough.

## 9. Top-K retrieval

For a question, the retriever:

1. Embeds the query.
2. Computes cosine similarity against **every** chunk.
3. Sorts descending by score.
4. Returns the top-3 results with full metadata and scores.

The UI always shows these top-3 chunks in the **Retrieved Evidence** panel, even when only some (or none) are used for the final answer.

## 10. Relevance threshold

`RELEVANCE_THRESHOLD = 0.45` (configurable via `RELEVANCE_THRESHOLD` env var). Only chunks with similarity ≥ the threshold are considered "relevant" and sent to the LLM.

If **no** chunk clears the threshold, the LLM is **not called**. The app returns:

> "I couldn't find enough information in the provided documents to answer this question."

and shows the retrieved evidence with the reason: "No retrieved passage exceeded the relevance threshold."

## 11. Grounded answer generation

When relevant passages exist, `generator.ts` sends **only** those passages plus the question to the OpenAI chat model. The system prompt forces grounded behavior:

> "You are a document-grounded question answering assistant. Answer ONLY using the supplied context. Do not use outside knowledge. Do not invent information. If the context does not contain enough information to answer the question, say that the information is not available in the provided documents. Keep answers concise. Identify the source passage used for the answer."

## 12. Citation system

Every successful answer is accompanied by the retrieved evidence, each showing:

- **Source document** — the `.md` filename
- **Section/heading** — the Markdown heading the chunk came from
- **Similarity score** — the cosine similarity (e.g. `0.87`)
- **Retrieved passage** — the actual chunk text (expandable in the UI)

No page numbers are fabricated — these are Markdown documents.

## 13. Hallucination prevention

Three layers keep the system honest:

1. **Threshold gate** — unrelated questions never reach the LLM.
2. **Strict system prompt** — the model is told to use only the context and to say "not available" otherwise.
3. **Visible evidence** — the retrieved passages and scores are shown to the user, so any answer can be checked against the source.

## 14. Setup instructions

Requirements: Node.js 18+.

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and add your OpenAI key
cp .env.example .env
#   then edit .env and set OPENAI_API_KEY=sk-...

# 3. Start the dev server
npm run dev
#   open the printed URL (default http://localhost:5173)
```

> The OpenAI key is read from the server environment and is never bundled into the browser.

### Without an API key

The app still runs. Retrieval works end-to-end and the Retrieved Evidence panel displays real chunks and scores. Only the final LLM answer is replaced with a notice that generation is disabled.

## 15. Environment variables

See `.env.example`:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | yes (for answers) | — | OpenAI API key, server-side only |
| `OPENAI_EMBEDDING_MODEL` | no | `text-embedding-3-small` | Embedding model |
| `OPENAI_CHAT_MODEL` | no | `gpt-4o-mini` | Chat model |
| `RELEVANCE_THRESHOLD` | no | `0.45` | Cosine similarity cutoff |

> In production the same variables are set as Supabase Edge Function secrets (see Deployment below). The frontend also reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (pre-populated by Bolt) to locate the edge function.

## 16. How the API route works

The frontend always POSTs to `/api/ask` in development and to the Supabase Edge Function (`/functions/v1/ask`) in production. The selection is automatic based on `import.meta.env.PROD`.

**Local dev** — `api/ask.ts` is a Vite dev/preview server middleware registered in `vite.config.ts`. It runs the same RAG pipeline (`src/rag/`) and reads `OPENAI_API_KEY` from the local `.env`.

**Production** — `supabase/functions/ask/index.ts` is a self-contained Supabase Edge Function (Deno). It carries its own copy of the chunker, cosine similarity, and generator logic because edge functions cannot import application source. It reads `OPENAI_API_KEY` from edge function secrets. CORS headers are set on every response.

Both paths return the same `RagAnswer` JSON shape so the frontend is identical.

## 17. Deployment

### Bolt hosting (default)

1. Add `OPENAI_API_KEY` as an edge function secret in the Bolt database settings (Secrets tab).
2. Publish the project from Bolt — the frontend builds to static files and the edge function is already deployed.
3. The frontend automatically calls the edge function in production.

### Vercel / Netlify (alternative)

The static frontend deploys as-is. The `/api/ask` route needs a serverless function backend — either point the frontend at the deployed Supabase Edge Function, or adapt `api/ask.ts` into the platform's serverless format. The current setup uses the Supabase Edge Function as the production API.

### Deploying the edge function

The edge function is deployed via the Supabase MCP tools (or Bolt's built-in deploy). After changing `supabase/functions/ask/index.ts`, redeploy and verify with:

```bash
curl -X POST <SUPABASE_URL>/functions/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"question":"How often does NimbusNote sync in the background?"}'
```

## 18. Example questions

1. "How often does NimbusNote sync in the background?" → answers from `01-getting-started.md` → Sync behavior
2. "What does the Pro plan cost?" → answers from `02-pricing-and-plans.md` → Pro plan
3. "How do I reset my password?" → answers from `03-troubleshooting.md` → Account recovery
4. "What is the capital of France?" → **no reliable answer found** (outside the corpus)

## 19. Testing

```bash
npm test
```

Tests (vitest) cover:

- **Cosine similarity** — identical, orthogonal, zero-vector cases
- **Document loading** — three documents, correct filenames, non-empty text
- **Chunk creation** — metadata present, contiguous 0-based indices
- **Retrieval ranking** — results sorted by descending score
- **Source metadata** — every result carries filename/section/text/score
- **Unrelated-query rejection** — "capital of France" clears no threshold
- **Result ordering** — sync question → Getting Started doc; pricing question → Pricing doc
- **API response shape** — citations present, evidence sorted, no API key leaked, unsupported questions rejected

## 20. Limitations

- The knowledge base is fixed to the three MLSA documents (by design).
- In-memory vector store is rebuilt on server restart (no persistence needed for this task).
- Answer quality depends on the OpenAI chat model; without a key, only retrieval is shown.
- Cosine similarity on short headings can occasionally surface a borderline chunk; the threshold mitigates this.

## 21. Future improvements

- Persist embeddings to a local file to skip re-embedding on restart.
- Add a second-stage reranker for tighter relevance.
- Support uploading additional documents at runtime.
- Stream the LLM answer token-by-token.
- Add a per-chunk "used in answer" badge in the evidence panel.
