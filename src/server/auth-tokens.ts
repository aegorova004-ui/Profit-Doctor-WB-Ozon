import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_LOGIN_CODE_DIGITS = 6;
const DEFAULT_SESSION_TOKEN_BYTES = 32;
const MAX_LOGIN_CODE_DIGITS = 10;
const MIN_LOGIN_CODE_DIGITS = 4;

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function verifySecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function generateSessionToken(
  byteLength = DEFAULT_SESSION_TOKEN_BYTES,
): string {
  if (!Number.isSafeInteger(byteLength) || byteLength < 16) {
    throw new RangeError("session token must contain at least 16 random bytes");
  }

  return randomBytes(byteLength).toString("base64url");
}

export function generateLoginCode(digits = DEFAULT_LOGIN_CODE_DIGITS): string {
  if (
    !Number.isSafeInteger(digits) ||
    digits < MIN_LOGIN_CODE_DIGITS ||
    digits > MAX_LOGIN_CODE_DIGITS
  ) {
    throw new RangeError(
      `login code length must be between ${MIN_LOGIN_CODE_DIGITS} and ${MAX_LOGIN_CODE_DIGITS} digits`,
    );
  }

  const max = 10 ** digits;
  const value = randomBytes(4).readUInt32BE(0) % max;

  return value.toString().padStart(digits, "0");
}

export function addMinutes(date: Date, minutes: number): Date {
  if (!Number.isFinite(minutes)) {
    throw new RangeError("minutes must be finite");
  }

  return new Date(date.getTime() + minutes * 60_000);
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
