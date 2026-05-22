/**
 * TeamFrame reliability suite runner.
 */

import { spawn } from "node:child_process";

const checks = [
  {
    label: "Multi-actor concurrency",
    command: "node",
    args: ["tests/reliability/multi-actor-concurrency-v2.mjs"],
  },
  {
    label: "Failure injection and rollback",
    command: "node",
    args: ["tests/reliability/failure-injection-v2.mjs"],
  },
  {
    label: "Session boundary enforcement",
    command: "node",
    args: ["tests/reliability/session-boundaries-v2.mjs"],
  },
];

function runCheck(check) {
  return new Promise((resolve, reject) => {
    const child = spawn(check.command, check.args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${check.label} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", (err) => reject(err));
  });
}

async function main() {
  for (const check of checks) {
    console.log(`\n• ${check.label}...`);
    await runCheck(check);
    console.log(`✓ ${check.label} passed.`);
  }

  console.log("\n✓ Reliability suite passed.");
}

main().catch((err) => {
  console.error(`\n✗ Reliability suite failed: ${err.message}`);
  process.exit(1);
});
