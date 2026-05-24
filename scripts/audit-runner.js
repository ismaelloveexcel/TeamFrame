#!/usr/bin/env node

const fs = require("node:fs");

function fail(reason, details = {}) {
  return {
    verdict: "FAIL",
    reason,
    details,
  };
}

function pass(evidence) {
  return {
    verdict: "PASS",
    evidence,
  };
}

function readJson(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`missing input file: ${path}`);
  }

  const raw = fs.readFileSync(path, "utf8").trim();
  if (!raw) {
    throw new Error(`empty input file: ${path}`);
  }

  return JSON.parse(raw);
}

function normalizeBoolean(value) {
  return value === true;
}

function runAudit(input) {
  const required = [
    "runtimeCorrectness",
    "onboardingFlow",
    "noSilentFailures",
    "securityBaseline",
  ];

  const missing = required.filter((key) => !(key in input));
  if (missing.length > 0) {
    return fail("missing_required_signals", { missing });
  }

  const failed = required.filter((key) => !normalizeBoolean(input[key]));
  if (failed.length > 0) {
    return fail("required_signals_failed", { failed });
  }

  return pass(
    Object.fromEntries(required.map((key) => [key, true])),
  );
}

function main() {
  const inputPath = process.argv[2] || "test-results.json";
  const outputPath = process.argv[3] || "audit.json";

  const input = readJson(inputPath);
  const result = runAudit(input);

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result)}\n`);

  if (result.verdict !== "PASS") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  const result = fail("audit_execution_error", {
    message: error instanceof Error ? error.message : String(error),
  });

  const outputPath = process.argv[3] || "audit.json";
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = 1;
}
