// Loads Markdown documents from the data/documents directory.
//
// The loader is used only on the server (the API route) and in tests — never
// in the browser bundle — so it reads the files from disk with fs. This keeps
// the knowledge base self-contained and avoids bundler-specific ?raw imports.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, "../../data/documents");

export interface LoadedDocument {
  filename: string;
  text: string;
}

// The three official MLSA SRM starter documents, in order.
export const DOCUMENTS: LoadedDocument[] = [
  { filename: "01-getting-started.md", text: "" },
  { filename: "02-pricing-and-plans.md", text: "" },
  { filename: "03-troubleshooting.md", text: "" },
].map((d) => ({
  ...d,
  text: readFileSync(join(DOCS_DIR, d.filename), "utf-8"),
}));

/** Return all loaded documents. */
export function loadDocuments(): LoadedDocument[] {
  return DOCUMENTS;
}

/** True if the documents directory contains the expected files. */
export function documentsPresent(): boolean {
  try {
    const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
    return files.length >= 3;
  } catch {
    return false;
  }
}
