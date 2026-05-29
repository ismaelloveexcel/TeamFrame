import { scrubPII } from "../lib/telemetry/scrub.ts";

// Direct import — using tsx via npx
const input = {
  users: [
    { name: "Alice", email: "alice@x.com", id: 1 },
    { name: "Bob", phone: "+447700900000", id: 2 },
  ],
  meta: {
    tokens: ["t1", "t2"],
    nested: [{ password: "secret123", role: "admin" }],
  },
  scalars: [1, 2, "three"],
  topEmail: "leak@x.com",
};

const out = scrubPII(input);
console.log(JSON.stringify(out, null, 2));

// Assertions
const u0 = out.users[0];
if (u0.email !== "[REDACTED]") throw new Error("FAIL: array element email not scrubbed");
if (u0.name !== "Alice") throw new Error("FAIL: harmless field changed");
const u1 = out.users[1];
if (u1.phone !== "[REDACTED]") throw new Error("FAIL: array element phone not scrubbed");
const nested0 = out.meta.nested[0];
if (nested0.password !== "[REDACTED]") throw new Error("FAIL: deep array object not scrubbed");
if (out.topEmail !== "[REDACTED]") throw new Error("FAIL: top-level PII not scrubbed");
if (JSON.stringify(out.scalars) !== JSON.stringify([1, 2, "three"]))
  throw new Error("FAIL: scalar array mutated");

console.log("\nALL ASSERTIONS PASS");
