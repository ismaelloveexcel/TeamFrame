/**
 * generateContract — the only allowed AI contract surface in TeamFrame V1.
 *
 * Contract (see /docs/ai-boundaries.md):
 *  - input: a narrow, typed struct of contract fields ONLY.
 *           No free-form employee record. No DB handle. No raw rows.
 *  - output: a populated contract template as markdown/plain text.
 *  - server-only. Never callable from a client component.
 *  - no DB access from inside this module.
 */

import "server-only";
import { z } from "zod";
import { getOpenAI } from "./client";

export const ContractInputSchema = z.object({
  fullName: z.string().min(1).max(200),
  roleTitle: z.string().min(1).max(200),
  department: z.string().min(1).max(120),
  startDate: z.string().min(1).max(40),
  employmentType: z.enum(["full_time", "part_time", "contractor"]),
  baseSalary: z.number().nonnegative(),
  currency: z.string().length(3),
  jurisdiction: z.string().min(1).max(120),
  companyName: z.string().min(1).max(200),
});

export type ContractInput = z.infer<typeof ContractInputSchema>;

const SYSTEM_PROMPT = [
  "You produce a clean, standard employment contract template populated with the provided fields.",
  "Rules:",
  "- Output plain markdown only.",
  "- Use ONLY the fields provided. Do not invent terms, benefits, or jurisdiction-specific clauses.",
  "- Do not provide legal, tax, or compliance advice.",
  "- Include a clear placeholder for legal review at the end.",
].join("\n");

export async function generateContract(input: ContractInput): Promise<string> {
  const parsed = ContractInputSchema.parse(input);

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(parsed) },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("generateContract: empty AI response.");
  }
  return text;
}
