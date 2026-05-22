#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const gates = [
  "db:apply",
  "db:test:rls",
  "db:test:stale",
  "test:employees",
  "test:security",
  "test:reliability",
  "typecheck",
  "lint",
  "build",
];

for (let i = 0; i < gates.length; i += 1) {
  const gate = gates[i];
  const label = `Gate ${i + 1}/${gates.length}`;
  console.log(`\n=== ${label}: npm run ${gate} ===`);

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  const result = spawnSync(npmCommand, ["run", gate], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    const code = result.status ?? 1;
    console.error(`\nCI gate failed at ${label} (${gate}) with exit code ${code}.`);
    process.exit(code);
  }
}

console.log("\nAll CI gates passed in strict order.");