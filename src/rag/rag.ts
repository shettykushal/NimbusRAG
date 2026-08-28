// Orchestrates the full RAG pipeline and owns the in-memory vector store.
//
// On first use, the corpus is loaded, chunked, and embedded once. The
// resulting EmbeddedChunks are cached in memory for the lifetime of the
// process — there is no external vector database. Each Q&A request then
// embeds only the query and runs the retriever + generator.

import type { Chunk, EmbeddedChunk, RagAnswer, RetrievalResult } from "./types";
import { loadDocuments } from "./loader";
import { chunkDocuments } from "./chunker";
import { embedChunks, type Embedder } from "./embeddings";
import { retrieve } from "./retriever";
import { generateAnswer } from "./generator";

export const DEFAULT_TOP_K = 3;
export const DEFAULT_THRESHOLD = 0.45;

export class RagEngine {
  private embedder: Embedder;
  private chunks: EmbeddedChunk[] | null = null;
  private initPromise: Promise<EmbeddedChunk[]> | null = null;

  constructor(embedder: Embedder) {
    this.embedder = embedder;
  }

  /** Load + chunk + embed the corpus once, then cache in memory. */
  async ensureIndex(): Promise<EmbeddedChunk[]> {
    if (this.chunks) return this.chunks;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const docs = loadDocuments();
      const chunks: Chunk[] = chunkDocuments(docs);
      const embedded = await embedChunks(chunks, this.embedder);
      this.chunks = embedded;
      return embedded;
    })();
    return this.initPromise;
  }

  /** Return the cached chunks (throws if not yet indexed). */
  getChunks(): EmbeddedChunk[] {
    if (!this.chunks) throw new Error("Index not built yet — call ensureIndex first");
    return this.chunks;
  }

  /**
   * Run the full pipeline for a question.
   *
   * 1. Ensure the corpus is indexed.
   * 2. Embed the query.
   * 3. Retrieve top-k chunks via cosine similarity.
   * 4. If nothing clears the threshold, do NOT call the LLM — return the
   *    "not found" message and still show the retrieved evidence.
   * 5. Otherwise, send only the relevant passages to the LLM and return
   *    the grounded answer with citations.
   */
  async ask(
    question: string,
    opts: { topK?: number; threshold?: number; apiKey?: string; chatModel?: string } = {},
  ): Promise<RagAnswer> {
    const topK = opts.topK ?? DEFAULT_TOP_K;
    const threshold = opts.threshold ?? DEFAULT_THRESHOLD;

    const chunks = await this.ensureIndex();
    const [queryVec] = await this.embedder.embed([question]);

    const outcome = retrieve(queryVec, chunks, { topK, threshold });
    const evidence: RetrievalResult[] = outcome.results;

    if (!outcome.hasRelevant) {
      return {
        answered: false,
        answer:
          "I couldn't find enough information in the provided documents to answer this question.",
        evidence,
        reason: "No retrieved passage exceeded the relevance threshold.",
        llmConfigured: false,
      };
    }

    const gen = await generateAnswer(question, outcome.relevant, {
      apiKey: opts.apiKey,
      model: opts.chatModel,
    });

    return {
      answered: true,
      answer: gen.answer,
      evidence,
      reason: `${outcome.relevant.length} passage(s) exceeded the relevance threshold of ${threshold}.`,
      llmConfigured: gen.configured,
    };
  }
}
