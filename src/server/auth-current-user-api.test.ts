import { describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "./auth-cookie";
import { handleGetCurrentUser } from "./auth-current-user-api";
import type { SessionCookieStore } from "./auth-current-user";
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

describe("handleGetCurrentUser", () => {
  it("returns current user resolved from session cookie", async () => {
    const repository = createRepository();

    await expect(
      handleGetCurrentUser(
        createCookies("session-token"),
        repository,
        new Date("2026-07-21T10:00:00.000Z"),
      ),
    ).resolves.toEqual({
      status: 200,
      body: {
        ok: true,
        user: { id: "user-1", email: "seller@example.com" },
      },
    });
    expect(repository.findByTokenHash).toHaveBeenCalledWith(
      hashSecret("session-token"),
    );
  });

  it("returns public unauthenticated response without repository query", async () => {
    const repository = createRepository();

    await expect(
      handleGetCurrentUser(
        createCookies(),
        repository,
        new Date("2026-07-21T10:00:00.000Z"),
      ),
    ).resolves.toEqual({
      status: 401,
      body: {
        ok: false,
        error: "unauthenticated",
        message: "Войдите в аккаунт.",
      },
    });
    expect(repository.findByTokenHash).not.toHaveBeenCalled();
  });
});
