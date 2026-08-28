// Deterministic fake embedder for tests.
//
// Maps a small vocabulary of keywords to orthogonal basis vectors so that
// cosine similarity is meaningful and predictable without any network call.
// This lets us test the retriever, ranking, and threshold logic in isolation.
//
// Document keywords (sync, background, pro, plan, price, cost, password,
// reset, image, upload, workspace, note) occupy distinct dimensions.
// Off-topic keywords (france, capital) occupy their OWN dimensions that no
// document chunk uses, so an unrelated query ends up near-zero similarity.

import type { Embedder } from "../src/rag/embeddings";

const DIM = 10;
const KEYWORDS: Record<string, number[]> = {
  // document vocabulary — dims 0..7
  sync: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  background: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  pro: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  plan: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  price: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  cost: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  password: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  reset: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  image: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  upload: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  workspace: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  note: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  // off-topic vocabulary — dims 8..9, NOT used by any document chunk
  france: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  capital: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
};

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function embedOne(text: string): number[] {
  const lower = text.toLowerCase();
  const vec = new Array(DIM).fill(0);
  for (const [kw, kv] of Object.entries(KEYWORDS)) {
    if (lower.includes(kw)) {
      for (let i = 0; i < DIM; i++) vec[i] += kv[i];
    }
  }
  return normalize(vec);
}

export const fakeEmbedder: Embedder = {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(embedOne);
  },
};
