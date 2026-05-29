/**
 * TeamFrame — PII scrubber
 *
 * Strips known personally-identifiable keys from arbitrary payloads before
 * they reach log output or Sentry. Used by both logger.ts (server) and
 * sentry.{client,server,edge}.config.ts (both sides).
 *
 * Rules:
 *  - keys are matched case-insensitively
 *  - nested objects are recursed up to MAX_DEPTH levels
 *  - arrays are recursed: object elements are scrubbed, scalars pass through
 *  - never throws
 */

const PII_KEYS = new Set([
  "email",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "phone_number",
  "mobile",
  "address",
  "street",
  "city",
  "postcode",
  "zip",
  "token",
  "magic_link",
  "otp",
  "password",
  "secret",
  "ip",
  "ip_address",
  "user_agent",
  "body",
  "raw_body",
  "request_body",
]);

const MAX_DEPTH = 5;

export function scrubPII(
  payload: Record<string, unknown>,
  _depth = 0,
): Record<string, unknown> {
  if (_depth > MAX_DEPTH) return payload;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? scrubPII(item as Record<string, unknown>, _depth + 1)
          : item,
      );
    } else if (
      value !== null &&
      typeof value === "object"
    ) {
      result[key] = scrubPII(value as Record<string, unknown>, _depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}
