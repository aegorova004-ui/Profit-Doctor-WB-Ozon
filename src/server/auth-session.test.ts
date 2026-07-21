import { describe, expect, it, vi } from "vitest";
import { hashSecret } from "./auth-tokens";
import {
  resolveCurrentUserFromSessionToken,
  type AuthSessionRepository,
  type AuthSessionRecord,
} from "./auth-session";

const now = new Date("2026-07-21T13:00:00.000Z");
const user = {
  id: "user_1",
  email: "seller@example.com",
};

function makeRepository(
  session: AuthSessionRecord | null,
): AuthSessionRepository & {
  findByTokenHash: ReturnType<typeof vi.fn>;
  markUsed: ReturnType<typeof vi.fn>;
} {
  return {
    findByTokenHash: vi.fn(async () => session),
    markUsed: vi.fn(async () => undefined),
  };
}

describe("auth session resolution", () => {
  it("returns null when the session cookie is missing", async () => {
    const repository = makeRepository(null);

    await expect(
      resolveCurrentUserFromSessionToken(null, repository, now),
    ).resolves.toBeNull();

    expect(repository.findByTokenHash).not.toHaveBeenCalled();
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it("looks up a session by token hash instead of plaintext token", async () => {
    const repository = makeRepository({
      tokenHash: hashSecret("session-token"),
      expiresAt: new Date("2026-07-21T14:00:00.000Z"),
      revokedAt: null,
      user,
    });

    await expect(
      resolveCurrentUserFromSessionToken(" session-token ", repository, now),
    ).resolves.toEqual(user);

    expect(repository.findByTokenHash).toHaveBeenCalledWith(
      hashSecret("session-token"),
    );
    expect(repository.findByTokenHash).not.toHaveBeenCalledWith(
      "session-token",
    );
    expect(repository.markUsed).toHaveBeenCalledWith(
      hashSecret("session-token"),
      now,
    );
  });

  it("returns null for an unknown session", async () => {
    const repository = makeRepository(null);

    await expect(
      resolveCurrentUserFromSessionToken("missing-token", repository, now),
    ).resolves.toBeNull();

    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it("returns null for an expired session", async () => {
    const repository = makeRepository({
      tokenHash: hashSecret("expired-token"),
      expiresAt: now,
      revokedAt: null,
      user,
    });

    await expect(
      resolveCurrentUserFromSessionToken("expired-token", repository, now),
    ).resolves.toBeNull();

    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it("returns null for a revoked session", async () => {
    const repository = makeRepository({
      tokenHash: hashSecret("revoked-token"),
      expiresAt: new Date("2026-07-21T14:00:00.000Z"),
      revokedAt: new Date("2026-07-21T12:30:00.000Z"),
      user,
    });

    await expect(
      resolveCurrentUserFromSessionToken("revoked-token", repository, now),
    ).resolves.toBeNull();

    expect(repository.markUsed).not.toHaveBeenCalled();
  });
});
