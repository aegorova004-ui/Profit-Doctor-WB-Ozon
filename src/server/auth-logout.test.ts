import { describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "./auth-cookie";
import type { SessionCookieStore } from "./auth-current-user";
import { handleLogout, type AuthLogoutRepository } from "./auth-logout";
import { hashSecret } from "./auth-tokens";

function createCookies(value?: string): SessionCookieStore {
  return {
    get: vi.fn((name: string) =>
      name === SESSION_COOKIE_NAME && value ? { value } : undefined,
    ),
  };
}

function createRepository(): AuthLogoutRepository {
  return {
    revokeAuthSession: vi.fn(async () => undefined),
  };
}

describe("handleLogout", () => {
  it("revokes current session and clears cookie", async () => {
    const repository = createRepository();
    const now = new Date("2026-07-21T10:07:00.000Z");

    await expect(
      handleLogout(createCookies("session-token"), repository, now),
    ).resolves.toEqual({
      response: {
        status: 200,
        body: {
          ok: true,
          message: "Вы вышли из аккаунта.",
        },
      },
      expiredCookie: {
        name: "profit_doctor_session",
        value: "",
        options: {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
          maxAge: 0,
        },
      },
    });
    expect(repository.revokeAuthSession).toHaveBeenCalledWith(
      hashSecret("session-token"),
      now,
    );
  });

  it("clears cookie without repository query when session cookie is absent", async () => {
    const repository = createRepository();

    await handleLogout(
      createCookies(),
      repository,
      new Date("2026-07-21T10:07:00.000Z"),
    );

    expect(repository.revokeAuthSession).not.toHaveBeenCalled();
  });
});
