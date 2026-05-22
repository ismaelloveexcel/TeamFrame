/**
 * TeamFrame — security regression suite runner.
 *
 * Runs foundational runtime security checks in sequence and fails fast.
 */

import { spawn } from "node:child_process";

const checks = [
  { label: "RLS adversarial smoke", command: "node", args: ["scripts/test-rls.mjs"] },
  { label: "Stale-write concurrency smoke", command: "node", args: ["scripts/test-stale-writes.mjs"] },
];

function runCheck(check) {
  return new Promise((resolve, reject) => {
    const child = spawn(check.command, check.args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${check.label} failed with exit code ${code ?? "unknown"}`));
      }
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

  console.log("\n✓ Security regression suite passed.");
}

main().catch((err) => {
  console.error(`\n✗ Security regression suite failed: ${err.message}`);
  process.exit(1);
});
