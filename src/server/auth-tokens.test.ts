import { describe, expect, it } from "vitest";
import {
  addMinutes,
  generateLoginCode,
  generateSessionToken,
  hashSecret,
  isExpired,
  verifySecret,
} from "./auth-tokens";

describe("auth tokens", () => {
  it("hashes and verifies secrets without storing plaintext", () => {
    const hash = hashSecret("123456");

    expect(hash).not.toBe("123456");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifySecret("123456", hash)).toBe(true);
    expect(verifySecret("654321", hash)).toBe(false);
  });

  it("returns false for malformed expected hashes", () => {
    expect(verifySecret("123456", "not-a-sha256-hash")).toBe(false);
  });

  it("generates session tokens with enough entropy for cookies", () => {
    const token = generateSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(generateSessionToken()).not.toBe(token);
  });

  it("rejects short session tokens", () => {
    expect(() => generateSessionToken(8)).toThrow(RangeError);
  });

  it("generates fixed-length numeric login codes", () => {
    expect(generateLoginCode()).toMatch(/^\d{6}$/);
    expect(generateLoginCode(4)).toMatch(/^\d{4}$/);
    expect(generateLoginCode(10)).toMatch(/^\d{10}$/);
  });

  it("rejects unsafe login code lengths", () => {
    expect(() => generateLoginCode(3)).toThrow(RangeError);
    expect(() => generateLoginCode(11)).toThrow(RangeError);
  });

  it("calculates expiry timestamps and states", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const expiresAt = addMinutes(now, 15);

    expect(expiresAt.toISOString()).toBe("2026-07-21T12:15:00.000Z");
    expect(isExpired(expiresAt, new Date("2026-07-21T12:14:59.999Z"))).toBe(
      false,
    );
    expect(isExpired(expiresAt, new Date("2026-07-21T12:15:00.000Z"))).toBe(
      true,
    );
  });
});
