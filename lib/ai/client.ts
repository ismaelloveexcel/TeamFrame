/**
 * OpenAI client for TeamFrame.
 *
 * Provider lock: OpenAI only. No multi-provider gateway in V1.
 * Surface lock: this module is imported ONLY by ./generateBio.ts and
 * ./generateContract.ts. No other file in /lib/ai may exist.
 */

import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/db/env";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}
