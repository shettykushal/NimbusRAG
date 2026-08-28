// Embedding generation for chunks and queries.
//
// Uses the OpenAI embeddings API. The embedding model and API key are read
// from environment variables on the server. A thin abstraction lets the
// retriever and tests work without a live network call: the "embed" function
// is injected so tests can supply deterministic fake vectors.

import OpenAI from "openai";
import type { Chunk, EmbeddedChunk } from "./types";

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

/** Default embedder backed by the OpenAI embeddings API. */
export class OpenAIEmbedder implements Embedder {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "text-embedding-3-small") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    // Sort by index to preserve input order.
    return res.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

/** Embed every chunk, returning chunks with their embedding vectors. */
export async function embedChunks(
  chunks: Chunk[],
  embedder: Embedder,
): Promise<EmbeddedChunk[]> {
  const vectors = await embedder.embed(chunks.map((c) => c.text));
  return chunks.map((c, i) => ({ ...c, embedding: vectors[i] }));
}
