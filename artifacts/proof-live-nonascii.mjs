// Live probe of /api/health with non-ASCII X-Healthcheck-Key.
// Before the byte-length fix, this would crash the route with RangeError
// (returning 500). After the fix, the route returns 200/503 cleanly.

const cases = [
  { label: "ascii-key", key: "a" },
  { label: "non-ascii (é)", key: "é" },
  { label: "emoji (🔑)", key: "🔑" },
  { label: "same-string-length-different-byte-length", key: "café" }, // 4 chars, 5 bytes
];

for (const c of cases) {
  try {
    const res = await fetch("http://localhost:3030/api/health", {
      headers: { "X-Healthcheck-Key": c.key },
    });
    const body = await res.text();
    console.log(`[${c.label}] status=${res.status} body=${body}`);
  } catch (e) {
    console.log(`[${c.label}] EXCEPTION: ${e.message}`);
  }
}
