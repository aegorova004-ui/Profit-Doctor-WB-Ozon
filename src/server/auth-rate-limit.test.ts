import { describe, expect, it } from "vitest";

import {
  LOGIN_CODE_REQUEST_RATE_LIMIT,
  LOGIN_CODE_VERIFY_RATE_LIMIT,
  checkAuthRateLimit,
} from "./auth-rate-limit";

function eventAt(iso: string) {
  return { createdAt: new Date(iso) };
}

describe("checkAuthRateLimit", () => {
  const now = new Date("2026-07-21T10:15:00.000Z");

  it("allows an action when the window has remaining attempts", () => {
    expect(
      checkAuthRateLimit(
        [
          eventAt("2026-07-21T10:01:00.000Z"),
          eventAt("2026-07-21T10:03:00.000Z"),
        ],
        LOGIN_CODE_REQUEST_RATE_LIMIT,
        now,
      ),
    ).toEqual({
      allowed: true,
      remainingAttempts: 1,
      retryAfterSeconds: 0,
    });
  });

  it("blocks when max attempts are already used inside the window", () => {
    expect(
      checkAuthRateLimit(
        [
          eventAt("2026-07-21T10:01:00.000Z"),
          eventAt("2026-07-21T10:03:00.000Z"),
          eventAt("2026-07-21T10:06:00.000Z"),
        ],
        LOGIN_CODE_REQUEST_RATE_LIMIT,
        now,
      ),
    ).toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: 60,
    });
  });

  it("ignores attempts outside the rolling window", () => {
    expect(
      checkAuthRateLimit(
        [
          eventAt("2026-07-21T09:59:59.000Z"),
          eventAt("2026-07-21T10:05:00.000Z"),
        ],
        LOGIN_CODE_REQUEST_RATE_LIMIT,
        now,
      ),
    ).toEqual({
      allowed: true,
      remainingAttempts: 2,
      retryAfterSeconds: 0,
    });
  });

  it("supports a separate verify-code policy", () => {
    expect(LOGIN_CODE_VERIFY_RATE_LIMIT).toEqual({
      maxAttempts: 5,
      windowSeconds: 900,
    });
  });

  it.each([
    { maxAttempts: 0, windowSeconds: 900 },
    { maxAttempts: 3, windowSeconds: 0 },
    { maxAttempts: 1.5, windowSeconds: 900 },
  ])("rejects invalid policy %#", (policy) => {
    expect(() => checkAuthRateLimit([], policy, now)).toThrow(RangeError);
  });
});
