import { describe, it, expect } from "vitest";
import { loadDocuments } from "../src/rag/loader";
import { chunkDocuments } from "../src/rag/chunker";
import { embedChunks } from "../src/rag/embeddings";
import { retrieve } from "../src/rag/retriever";
import { fakeEmbedder } from "./fakeEmbedder";

async function buildIndex() {
  const chunks = chunkDocuments(loadDocuments());
  return embedChunks(chunks, fakeEmbedder);
}

describe("retrieval ranking and metadata", () => {
  it("returns the top-3 results sorted by descending score", async () => {
    const index = await buildIndex();
    const [q] = await fakeEmbedder.embed(["How often does NimbusNote sync in the background?"]);
    const out = retrieve(q, index, { topK: 3, threshold: 0 });
    expect(out.results).toHaveLength(3);
    for (let i = 1; i < out.results.length; i++) {
      expect(out.results[i - 1].score).toBeGreaterThanOrEqual(out.results[i].score);
    }
  });

  it("each result preserves source metadata", async () => {
    const index = await buildIndex();
    const [q] = await fakeEmbedder.embed(["sync background"]);
    const out = retrieve(q, index, { topK: 3, threshold: 0 });
    for (const r of out.results) {
      expect(typeof r.filename).toBe("string");
      expect(typeof r.section).toBe("string");
      expect(typeof r.chunkIndex).toBe("number");
      expect(typeof r.text).toBe("string");
      expect(typeof r.score).toBe("number");
    }
  });

  it("the most relevant chunk for 'sync background' comes from the Getting Started doc", async () => {
    const index = await buildIndex();
    const [q] = await fakeEmbedder.embed(["sync background"]);
    const out = retrieve(q, index, { topK: 3, threshold: 0 });
    expect(out.results[0].filename).toBe("01-getting-started.md");
  });

  it("the most relevant chunk for 'pro plan cost' comes from the pricing doc", async () => {
    const index = await buildIndex();
    const [q] = await fakeEmbedder.embed(["What does the pro plan cost?"]);
    const out = retrieve(q, index, { topK: 3, threshold: 0 });
    expect(out.results[0].filename).toBe("02-pricing-and-plans.md");
  });
});

describe("unrelated-question handling", () => {
  it("no passage clears the threshold for an unrelated question", async () => {
    const index = await buildIndex();
    const [q] = await fakeEmbedder.embed(["What is the capital of France?"]);
    const out = retrieve(q, index, { topK: 3, threshold: 0.45 });
    expect(out.hasRelevant).toBe(false);
    expect(out.relevant).toHaveLength(0);
  });

  it("a related question clears the threshold", async () => {
    const index = await buildIndex();
    const [q] = await fakeEmbedder.embed(["How do I reset my password?"]);
    const out = retrieve(q, index, { topK: 3, threshold: 0.45 });
    expect(out.hasRelevant).toBe(true);
    expect(out.relevant.length).toBeGreaterThan(0);
  });
});
