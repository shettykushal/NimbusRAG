// Tests for the API response shape and security guarantees.
//
// These verify the RagAnswer contract that the edge function and the local
// dev middleware both return: citations present, evidence sorted, and the
// OpenAI key never appears in the response. They use the local RAG engine
// with the fake embedder so no network call is required.

import { describe, it, expect } from "vitest";
import { RagEngine } from "../src/rag/rag";
import { fakeEmbedder } from "./fakeEmbedder";

// Build an engine that uses the fake embedder and a fake "no key" generator.
// The generator returns a placeholder when no apiKey is passed, which lets
// us test the response shape without a real OpenAI call.
function makeEngine() {
  return new RagEngine(fakeEmbedder);
}

describe("API response shape (RagAnswer)", () => {
  it("a relevant question returns answered=true with citations", async () => {
    const engine = makeEngine();
    const res = await engine.ask("How often does NimbusNote sync in the background?");
    expect(res.answered).toBe(true);
    expect(res.evidence.length).toBeGreaterThan(0);
    // Every evidence item is a citation: filename + section + score + text.
    for (const e of res.evidence) {
      expect(e.filename).toBeTruthy();
      expect(e.section).toBeTruthy();
      expect(typeof e.score).toBe("number");
      expect(e.text).toBeTruthy();
    }
  });

  it("evidence is sorted by descending similarity score", async () => {
    const engine = makeEngine();
    const res = await engine.ask("sync background");
    for (let i = 1; i < res.evidence.length; i++) {
      expect(res.evidence[i - 1].score).toBeGreaterThanOrEqual(res.evidence[i].score);
    }
  });

  it("an unsupported question returns answered=false and the not-found message", async () => {
    const engine = makeEngine();
    const res = await engine.ask("What is the capital of France?");
    expect(res.answered).toBe(false);
    expect(res.answer).toContain("couldn't find enough information");
    // Evidence is still returned so the user can see what was retrieved.
    expect(res.evidence.length).toBeGreaterThan(0);
  });

  it("the response never contains an OpenAI API key", async () => {
    const engine = makeEngine();
    const res = await engine.ask("How do I reset my password?");
    const serialized = JSON.stringify(res);
    // No key-like string should ever appear in the response body.
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
  });

  it("the reason field explains why the answer was or was not generated", async () => {
    const engine = makeEngine();
    const ok = await engine.ask("sync background");
    expect(ok.reason).toContain("threshold");
    const no = await engine.ask("What is the capital of France?");
    expect(no.reason).toContain("threshold");
  });
});
