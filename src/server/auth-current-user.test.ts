import { describe, expect, it, vi } from "vitest";

import {
  getSessionTokenFromCookies,
  resolveCurrentUserFromCookies,
  type SessionCookieStore,
} from "./auth-current-user";
import { SESSION_COOKIE_NAME } from "./auth-cookie";
import type { AuthSessionRepository } from "./auth-session";
import { hashSecret } from "./auth-tokens";

function createCookies(value?: string): SessionCookieStore {
  return {
    get: vi.fn((name: string) =>
      name === SESSION_COOKIE_NAME && value ? { value } : undefined,
    ),
  };
}

function createRepository(): AuthSessionRepository {
  return {
    findByTokenHash: vi.fn(async () => ({
      tokenHash: hashSecret("session-token"),
      expiresAt: new Date("2026-08-20T10:00:00.000Z"),
      revokedAt: null,
      user: { id: "user-1", email: "seller@example.com" },
    })),
    markUsed: vi.fn(async () => undefined),
  };
}

describe("getSessionTokenFromCookies", () => {
  it("reads the product session cookie", () => {
    const cookies = createCookies("session-token");

    expect(getSessionTokenFromCookies(cookies)).toBe("session-token");
    expect(cookies.get).toHaveBeenCalledWith("profit_doctor_session");
  });

  it("returns null when the session cookie is absent", () => {
    expect(getSessionTokenFromCookies(createCookies())).toBeNull();
  });
});

describe("resolveCurrentUserFromCookies", () => {
  it("resolves the current user through the session repository", async () => {
    const repository = createRepository();
    const now = new Date("2026-07-21T10:00:00.000Z");

    const session = await resolveCurrentUserFromCookies(
      createCookies("session-token"),
      repository,
      now,
    );

    expect(repository.findByTokenHash).toHaveBeenCalledWith(
      hashSecret("session-token"),
    );
    expect(repository.markUsed).toHaveBeenCalledWith(
      hashSecret("session-token"),
      now,
    );
    expect(session).toEqual({
      user: { id: "user-1", email: "seller@example.com" },
      cookieName: "profit_doctor_session",
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 2_592_000,
      },
    });
  });

  it("returns null without querying when cookie is absent", async () => {
    const repository = createRepository();

    const session = await resolveCurrentUserFromCookies(
      createCookies(),
      repository,
      new Date("2026-07-21T10:00:00.000Z"),
    );

    expect(session).toBeNull();
    expect(repository.findByTokenHash).not.toHaveBeenCalled();
    expect(repository.markUsed).not.toHaveBeenCalled();
  });
});
