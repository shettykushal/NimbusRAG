// Retriever: the heart of the RAG pipeline.
//
// Given a query embedding and a set of embedded chunks, compute cosine
// similarity against every chunk, sort descending, and return the top-k.
// A configurable relevance threshold decides whether any result is "good
// enough" to ground an LLM answer.
//
// Cosine similarity is implemented explicitly with NumPy-style vector math
// (dot product / (norm * norm)) so the retrieval step is transparent and
// easy to explain in a technical walkthrough.

import type { EmbeddedChunk, RetrievalResult } from "./types";

/**
 * Cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; for normalized embeddings this is ~[0, 1].
 * Implemented explicitly (no external vector library) so the math is visible.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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

export interface RetrieveOptions {
  topK?: number;
  threshold?: number;
}

export interface RetrieveOutcome {
  /** Top-k results, sorted by score descending. */
  results: RetrievalResult[];
  /** Only the results that cleared the threshold (subset of results). */
  relevant: RetrievalResult[];
  /** True if at least one result cleared the threshold. */
  hasRelevant: boolean;
  /** The threshold used. */
  threshold: number;
}

/**
 * Retrieve the top-k chunks for a query embedding.
 *
 * 1. Compare the query against all chunk embeddings (cosine similarity).
 * 2. Sort descending by score.
 * 3. Return the top-k with metadata + scores.
 * 4. Split into "all top-k" (for the Retrieved Evidence panel) and
 *    "relevant" (those above the threshold, used to ground the answer).
 */
export function retrieve(
  queryEmbedding: number[],
  chunks: EmbeddedChunk[],
  opts: RetrieveOptions = {},
): RetrieveOutcome {
  const topK = opts.topK ?? 3;
  const threshold = opts.threshold ?? 0.45;

  const scored: RetrievalResult[] = chunks.map((c) => ({
    filename: c.filename,
    section: c.section,
    chunkIndex: c.chunkIndex,
    text: c.text,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  // Sort descending by similarity score.
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, topK);
  const relevant = results.filter((r) => r.score >= threshold);

  return {
    results,
    relevant,
    hasRelevant: relevant.length > 0,
    threshold,
  };
}
