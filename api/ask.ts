// Server-side API route for the RAG pipeline.
//
// This runs in the Vite dev server (and in the preview/build server via the
// middleware) so the OPENAI_API_KEY never reaches the browser. The browser
// POSTs a question to /api/ask and receives the retrieved evidence + answer.
//
// The RAG engine (corpus + embeddings) lives in module scope so the index is
// built once and reused across requests — there is no external vector DB.

import type { ViteDevServer, PreviewServer } from "vite";
import { RagEngine, OpenAIEmbedder } from "../src/rag/index";

let engine: RagEngine | null = null;

function getEngine(): RagEngine {
  if (engine) return engine;
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  // Even without a key we build the engine; embedding will fail, but we
  // handle that gracefully in the request handler.
  const embedder = new OpenAIEmbedder(apiKey, process.env.OPENAI_EMBEDDING_MODEL);
  engine = new RagEngine(embedder);
  return engine;
}

/** Attach the /api/ask route to a Vite dev or preview server. */
export function setupApi(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use("/api/ask", async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Read the request body.
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    let payload: { question?: string } = {};
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const question = (payload.question ?? "").trim();
    if (!question) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Question is required" }));
      return;
    }

    try {
      const eng = getEngine();
      const answer = await eng.ask(question, {
        apiKey: process.env.OPENAI_API_KEY,
        chatModel: process.env.OPENAI_CHAT_MODEL,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(answer));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            err instanceof Error
              ? err.message
              : "Unknown error during RAG pipeline",
        }),
      );
    }
  });
}
