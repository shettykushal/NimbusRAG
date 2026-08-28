// Answer generation: sends ONLY the retrieved context + question to the LLM.
//
// The system prompt forces the model to answer strictly from the supplied
// context and to cite the source passage. If no OpenAI key is configured on
// the server, generation is skipped and the UI shows a clear message — but
// retrieval still runs and is displayed, so the pipeline is always visible.

import OpenAI from "openai";
import type { RetrievalResult } from "./types";

export const SYSTEM_PROMPT = `You are a document-grounded question answering assistant.

Answer ONLY using the supplied context.
Do not use outside knowledge.
Do not invent information.
If the context does not contain enough information to answer the question, say that the information is not available in the provided documents.
Keep answers concise.
Identify the source passage used for the answer.`;

export interface GenerateOptions {
  apiKey?: string;
  model?: string;
}

export interface GenerateResult {
  answer: string;
  configured: boolean;
}

/**
 * Generate a grounded answer from retrieved passages.
 *
 * If no API key is configured, returns a placeholder answer and
 * configured=false so the UI can explain that generation is disabled.
 * The retrieved evidence is still returned by the caller.
 */
export async function generateAnswer(
  question: string,
  evidence: RetrievalResult[],
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return {
      answer:
        "(Answer generation is disabled — set OPENAI_API_KEY on the server. " +
        "Retrieval ran successfully and is shown below.)",
      configured: false,
    };
  }

  const model = opts.model ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const context = evidence
    .map(
      (r, i) =>
        `[Passage ${i + 1}] Source: ${r.filename}\nSection: ${r.section}\nSimilarity: ${r.score.toFixed(
          2,
        )}\n"${r.text}"`,
    )
    .join("\n\n");

  const userPrompt = `Context passages retrieved from the document set:

${context}

Question: ${question}

Answer the question using ONLY the context above. Cite the source filename and section you used.`;

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 300,
  });

  return {
    answer: res.choices[0]?.message?.content?.trim() ?? "",
    configured: true,
  };
}
