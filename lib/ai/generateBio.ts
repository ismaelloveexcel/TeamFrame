/**
 * generateBio — the only allowed AI bio surface in TeamFrame V1.
 *
 * Contract (see /docs/ai-boundaries.md):
 *  - input: CV text ONLY (string). No employee record. No compensation.
 *  - output: a 3–5 sentence professional bio (plain text).
 *  - server-only. Never callable from a client component.
 *  - no DB access from inside this module.
 */

import "server-only";
import { getOpenAI } from "./client";

const MAX_INPUT_CHARS = 16_000;

const SYSTEM_PROMPT = [
  "You write short, neutral, factual employee bios from CV text.",
  "Rules:",
  "- 3 to 5 sentences total.",
  "- Third person, present tense.",
  "- No claims that are not in the CV.",
  "- No personality inference, scoring, ranking, or fit assessment.",
  "- No salary, location, age, or contact details.",
  "- Plain text only. No lists, headings, or markdown.",
].join("\n");

export async function generateBio(cvText: string): Promise<string> {
  if (typeof cvText !== "string") {
    throw new Error("generateBio: cvText must be a string.");
  }
  const trimmed = cvText.trim();
  if (trimmed.length === 0) {
    throw new Error("generateBio: cvText is empty.");
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new Error("generateBio: cvText exceeds maximum length.");
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("generateBio: empty AI response.");
  }
  return text;
}
