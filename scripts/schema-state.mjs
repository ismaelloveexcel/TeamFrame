#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_ORDER } from "./schema-order.mjs";

const repoRoot = process.cwd();
const orderedFiles = SCHEMA_ORDER.map((name) => join(repoRoot, "schemas", name));

const fileHashes = SCHEMA_ORDER.map((name, index) => {
  const content = readFileSync(orderedFiles[index], "utf8");
  const sha256 = createHash("sha256").update(content).digest("hex");
  return { name, sha256 };
});

const overall = createHash("sha256")
  .update(JSON.stringify(fileHashes))
  .digest("hex");

const payload = {
  generatedAt: new Date().toISOString(),
  schemaOrder: SCHEMA_ORDER,
  files: fileHashes,
  overallSha256: overall,
};

const outDir = join(repoRoot, ".ci", "schema-state");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "schema-state.json");
writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log(`Schema state written: ${outPath}`);
console.log(`Schema overall sha256: ${overall}`);
