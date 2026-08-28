import { describe, it, expect } from "vitest";
import { loadDocuments } from "../src/rag/loader";
import { chunkDocuments, chunkDocument } from "../src/rag/chunker";

describe("document loading", () => {
  it("loads exactly three documents", () => {
    const docs = loadDocuments();
    expect(docs).toHaveLength(3);
  });

  it("preserves the expected filenames", () => {
    const docs = loadDocuments();
    expect(docs.map((d) => d.filename).sort()).toEqual([
      "01-getting-started.md",
      "02-pricing-and-plans.md",
      "03-troubleshooting.md",
    ]);
  });

  it("each document has non-empty text", () => {
    for (const d of loadDocuments()) {
      expect(d.text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("chunk creation", () => {
  it("produces chunks for every document", () => {
    const docs = loadDocuments();
    const chunks = chunkDocuments(docs);
    expect(chunks.length).toBeGreaterThan(3);
  });

  it("every chunk carries filename, section, chunkIndex, and text", () => {
    for (const c of chunkDocuments(loadDocuments())) {
      expect(typeof c.filename).toBe("string");
      expect(c.filename.length).toBeGreaterThan(0);
      expect(typeof c.section).toBe("string");
      expect(c.section.length).toBeGreaterThan(0);
      expect(typeof c.chunkIndex).toBe("number");
      expect(typeof c.text).toBe("string");
      expect(c.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("chunkIndex is 0-based and contiguous within a document", () => {
    const docs = loadDocuments();
    const doc = docs[0];
    const chunks = chunkDocument(doc);
    expect(chunks[0].chunkIndex).toBe(0);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }
  });

  it("all chunks for a document share its filename", () => {
    const doc = loadDocuments()[1];
    const chunks = chunkDocument(doc);
    expect(chunks.every((c) => c.filename === doc.filename)).toBe(true);
  });
});
