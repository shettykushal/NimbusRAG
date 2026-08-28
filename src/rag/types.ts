// Shared types used across the RAG pipeline.

/** A chunk of a document with the metadata the evaluator requires. */
export interface Chunk {
  /** Original filename, e.g. "01-getting-started.md". */
  filename: string;
  /** Heading / section the chunk belongs to. */
  section: string;
  /** Zero-based index of this chunk within its source document. */
  chunkIndex: number;
  /** The original text of the chunk. */
  text: string;
}

/** A chunk paired with its embedding vector. */
export interface EmbeddedChunk extends Chunk {
  /** Embedding vector from the OpenAI embedding model. */
  embedding: number[];
}

/** A single retrieval result with similarity score and metadata. */
export interface RetrievalResult {
  filename: string;
  section: string;
  chunkIndex: number;
  text: string;
  /** Cosine similarity in [0, 1]. Higher is more relevant. */
  score: number;
}

/** The full answer to a Q&A request, returned to the UI. */
export interface RagAnswer {
  /** Whether the LLM was called. False when nothing cleared the threshold. */
  answered: boolean;
  /** The generated answer, or the "not found" message. */
  answer: string;
  /** Top-k retrieved chunks (always returned, even when below threshold). */
  evidence: RetrievalResult[];
  /** Why the system did or did not answer. */
  reason: string;
  /** Whether the OpenAI key was configured on the server. */
  llmConfigured: boolean;
}
