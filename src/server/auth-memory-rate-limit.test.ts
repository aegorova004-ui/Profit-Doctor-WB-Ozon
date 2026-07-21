import { describe, expect, it } from "vitest";

import {
  clearAuthRateLimitEvents,
  getAuthRateLimitEvents,
  recordAuthRateLimitEvent,
} from "./auth-memory-rate-limit";

describe("auth memory rate-limit events", () => {
  it("stores events separately by action and normalized email key", () => {
    clearAuthRateLimitEvents();

    recordAuthRateLimitEvent(
      "request_code",
      "seller@example.com",
      new Date("2026-07-21T10:00:00.000Z"),
    );
    recordAuthRateLimitEvent(
      "verify_code",
      "seller@example.com",
      new Date("2026-07-21T10:01:00.000Z"),
    );

    expect(
      getAuthRateLimitEvents(
        "request_code",
        "seller@example.com",
        new Date("2026-07-21T10:05:00.000Z"),
      ),
    ).toEqual([{ createdAt: new Date("2026-07-21T10:00:00.000Z") }]);
    expect(
      getAuthRateLimitEvents(
        "verify_code",
        "seller@example.com",
        new Date("2026-07-21T10:05:00.000Z"),
      ),
    ).toEqual([{ createdAt: new Date("2026-07-21T10:01:00.000Z") }]);
  });

  it("drops stale events outside retention window", () => {
    clearAuthRateLimitEvents();

    recordAuthRateLimitEvent(
      "request_code",
      "seller@example.com",
      new Date("2026-07-21T09:59:59.000Z"),
    );
    recordAuthRateLimitEvent(
      "request_code",
      "seller@example.com",
      new Date("2026-07-21T10:01:00.000Z"),
    );

    expect(
      getAuthRateLimitEvents(
        "request_code",
        "seller@example.com",
        new Date("2026-07-21T10:15:00.000Z"),
      ),
    ).toEqual([{ createdAt: new Date("2026-07-21T10:01:00.000Z") }]);
  });
});
