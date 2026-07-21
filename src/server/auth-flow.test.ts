import { describe, expect, it, vi } from "vitest";

import { requestLoginCode, verifyLoginCodeAndCreateSession } from "./auth-flow";
import { type AuthPrismaRepository } from "./auth-prisma-repository";
import { hashSecret } from "./auth-tokens";

function createRepository(): AuthPrismaRepository {
  return {
    createLoginCode: vi.fn(async () => undefined),
    findLatestByEmail: vi.fn(async () => ({
      id: "code-1",
      email: "seller@example.com",
      codeHash: hashSecret("123456"),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
      consumedAt: null,
    })),
    consume: vi.fn(async () => undefined),
    upsertUserByEmail: vi.fn(async () => ({
      id: "user-1",
      email: "seller@example.com",
    })),
    findByTokenHash: vi.fn(async () => null),
    markUsed: vi.fn(async () => undefined),
    createAuthSession: vi.fn(async () => undefined),
  };
}

describe("requestLoginCode", () => {
  it("creates a hashed login code and sends plaintext only through delivery", async () => {
    const repository = createRepository();
    const delivery = {
      sendLoginCode: vi.fn(async () => undefined),
    };
    const now = new Date("2026-07-21T10:00:00.000Z");

    const result = await requestLoginCode(
      " Seller@Example.COM ",
      repository,
      delivery,
      now,
    );

    expect(result).toEqual({
      ok: true,
      email: "seller@example.com",
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
    });
    expect(repository.createLoginCode).toHaveBeenCalledWith({
      email: "seller@example.com",
      codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
    });
    expect(delivery.sendLoginCode).toHaveBeenCalledWith({
      email: "seller@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
    });
  });
});

describe("verifyLoginCodeAndCreateSession", () => {
  it("consumes a valid code and creates a hashed auth session", async () => {
    const repository = createRepository();
    const now = new Date("2026-07-21T10:05:00.000Z");

    const result = await verifyLoginCodeAndCreateSession(
      "seller@example.com",
      "123456",
      repository,
      now,
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.user).toEqual({
      id: "user-1",
      email: "seller@example.com",
    });
    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    expect(result.sessionExpiresAt).toEqual(
      new Date("2026-08-20T10:05:00.000Z"),
    );
    expect(repository.createAuthSession).toHaveBeenCalledWith({
      userId: "user-1",
      tokenHash: hashSecret(result.sessionToken),
      expiresAt: new Date("2026-08-20T10:05:00.000Z"),
    });
  });

  it("does not create a session for an invalid code", async () => {
    const repository = createRepository();
    vi.mocked(repository.findLatestByEmail).mockResolvedValue(null);

    const result = await verifyLoginCodeAndCreateSession(
      "seller@example.com",
      "000000",
      repository,
      new Date("2026-07-21T10:05:00.000Z"),
    );

    expect(result).toEqual({ ok: false, reason: "invalid_code" });
    expect(repository.createAuthSession).not.toHaveBeenCalled();
  });
});
