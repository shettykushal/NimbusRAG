// Splits a Markdown document into meaningful chunks.
//
// Strategy: split by Markdown headings (## and ###). Each chunk keeps the
// heading as its "section" metadata. The top-level document title (# H1) is
// treated as the document intro and gets its own chunk. This gives the
// retriever semantically coherent passages rather than arbitrary character
// windows, which makes the citations meaningful ("Section: Sync behavior").

import type { Chunk } from "./types";
import type { LoadedDocument } from "./loader";

// Heading line -> { level, title }. Matches ## and ### (and # for the title).
const HEADING_RE = /^(#{1,3})\s+(.*)$/;

interface HeadingInfo {
  level: number;
  title: string;
}

function parseHeading(line: string): HeadingInfo | null {
  const m = line.match(HEADING_RE);
  if (!m) return null;
  return { level: m[1].length, title: m[2].trim() };
}

/**
 * Chunk a single document by its headings.
 *
 * Each section (heading + body until the next same-or-higher heading) becomes
 * one chunk. The H1 title becomes a chunk whose section is the document title.
 */
export function chunkDocument(doc: LoadedDocument): Chunk[] {
  const lines = doc.text.split("\n");
  const chunks: Chunk[] = [];

  let currentSection = "";
  let buffer: string[] = [];

  const flush = (section: string, index: number) => {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        filename: doc.filename,
        section: section || "Untitled",
        chunkIndex: index,
        text,
      });
    }
    buffer = [];
  };

  let chunkIndex = 0;
  for (const line of lines) {
    const heading = parseHeading(line);
    if (heading) {
      // Start of a new section: flush the previous one.
      flush(currentSection, chunkIndex);
      chunkIndex += 1;
      currentSection = heading.title;
      // Keep the heading line in the chunk text so the passage reads naturally.
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  // Flush the final section.
  flush(currentSection, chunkIndex);

  // Re-number chunk indices to be 0-based and contiguous per document.
  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}

/** Chunk all documents in the corpus. */
export function chunkDocuments(docs: LoadedDocument[]): Chunk[] {
  return docs.flatMap((d) => chunkDocument(d));
}
