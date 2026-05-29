// Proof: the OLD safeCompareSecret would have thrown RangeError when
// candidate.length === secret.length (UTF-16 code units) but byte length differed.
// The NEW implementation rejects safely via byte-length pre-check.

import { timingSafeEqual } from "node:crypto";

// "café" = 4 UTF-16 code units = 5 bytes (é = 2 bytes)
// "cafe1" = 5 UTF-16 code units = 5 bytes
// Different shape: pick two strings with same .length but different byte length:
const a = "café"; // length 4, 5 bytes
const b = "caf!"; // length 4, 4 bytes

console.log(`a="${a}" .length=${a.length} bytes=${Buffer.from(a, "utf8").length}`);
console.log(`b="${b}" .length=${b.length} bytes=${Buffer.from(b, "utf8").length}`);

// OLD logic
function oldSafeCompare(candidate, secret) {
  if (candidate.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(secret));
}

// NEW logic
function newSafeCompare(candidate, secret) {
  const cb = Buffer.from(candidate, "utf8");
  const sb = Buffer.from(secret, "utf8");
  if (cb.length !== sb.length) return false;
  return timingSafeEqual(cb, sb);
}

try {
  const r = oldSafeCompare(a, b);
  console.log(`OLD returned ${r} (no crash — false negative on this pair)`);
} catch (e) {
  console.log(`OLD threw: ${e.constructor.name}: ${e.message}`);
}

try {
  const r = newSafeCompare(a, b);
  console.log(`NEW returned ${r} (no crash)`);
} catch (e) {
  console.log(`NEW threw: ${e.constructor.name}: ${e.message}`);
}

// Stronger case: both string length AND a real crash trigger
// "🔑" = 2 UTF-16 code units = 4 bytes
// "ab" = 2 UTF-16 code units = 2 bytes
const c = "🔑";
const d = "ab";
console.log(`\nc="${c}" .length=${c.length} bytes=${Buffer.from(c, "utf8").length}`);
console.log(`d="${d}" .length=${d.length} bytes=${Buffer.from(d, "utf8").length}`);

try {
  const r = oldSafeCompare(c, d);
  console.log(`OLD returned ${r}`);
} catch (e) {
  console.log(`OLD threw: ${e.constructor.name}: ${e.message}  <-- this is the public-endpoint crash`);
}

try {
  const r = newSafeCompare(c, d);
  console.log(`NEW returned ${r} (no crash — protection holds)`);
} catch (e) {
  console.log(`NEW threw: ${e.constructor.name}: ${e.message}`);
}
