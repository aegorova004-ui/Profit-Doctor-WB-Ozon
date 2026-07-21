import { describe, expect, it, vi } from "vitest";

import {
  type CreateLoginCodeRepository,
  type LoginCodeRecord,
  type LoginCodeRepository,
  consumeLoginCode,
  issueLoginCode,
} from "./auth-login-code";
import { hashSecret } from "./auth-tokens";

function createRepository(
  loginCode: LoginCodeRecord | null,
): LoginCodeRepository {
  return {
    findLatestByEmail: vi.fn(async () => loginCode),
    consume: vi.fn(async () => undefined),
    upsertUserByEmail: vi.fn(async (email: string) => ({
      id: "user-1",
      email,
    })),
  };
}

describe("issueLoginCode", () => {
  it("normalizes email and stores only code hash", async () => {
    const now = new Date("2026-07-21T10:00:00.000Z");
    const repository: CreateLoginCodeRepository = {
      createLoginCode: vi.fn(async () => undefined),
    };

    const result = await issueLoginCode(
      " Seller@Example.COM ",
      repository,
      now,
    );

    expect(result.email).toBe("seller@example.com");
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.expiresAt).toEqual(new Date("2026-07-21T10:10:00.000Z"));
    expect(repository.createLoginCode).toHaveBeenCalledWith({
      email: "seller@example.com",
      codeHash: hashSecret(result.code),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
    });
    expect(repository.createLoginCode).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: result.code }),
    );
  });
});

describe("consumeLoginCode", () => {
  const now = new Date("2026-07-21T10:05:00.000Z");

  it("consumes a valid latest code and returns the user", async () => {
    const repository = createRepository({
      id: "code-1",
      email: "seller@example.com",
      codeHash: hashSecret("123456"),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
      consumedAt: null,
    });

    const user = await consumeLoginCode(
      " Seller@Example.COM ",
      " 123456 ",
      repository,
      now,
    );

    expect(repository.findLatestByEmail).toHaveBeenCalledWith(
      "seller@example.com",
    );
    expect(repository.consume).toHaveBeenCalledWith("code-1", now);
    expect(repository.upsertUserByEmail).toHaveBeenCalledWith(
      "seller@example.com",
    );
    expect(user).toEqual({ id: "user-1", email: "seller@example.com" });
  });

  it("rejects an empty code without consuming", async () => {
    const repository = createRepository(null);

    const user = await consumeLoginCode(
      "seller@example.com",
      "   ",
      repository,
      now,
    );

    expect(user).toBeNull();
    expect(repository.findLatestByEmail).not.toHaveBeenCalled();
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it("rejects an unknown code", async () => {
    const repository = createRepository(null);

    const user = await consumeLoginCode(
      "seller@example.com",
      "123456",
      repository,
      now,
    );

    expect(user).toBeNull();
    expect(repository.consume).not.toHaveBeenCalled();
    expect(repository.upsertUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects an already consumed code", async () => {
    const repository = createRepository({
      id: "code-1",
      email: "seller@example.com",
      codeHash: hashSecret("123456"),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
      consumedAt: new Date("2026-07-21T10:04:00.000Z"),
    });

    const user = await consumeLoginCode(
      "seller@example.com",
      "123456",
      repository,
      now,
    );

    expect(user).toBeNull();
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it("rejects an expired code", async () => {
    const repository = createRepository({
      id: "code-1",
      email: "seller@example.com",
      codeHash: hashSecret("123456"),
      expiresAt: new Date("2026-07-21T10:05:00.000Z"),
      consumedAt: null,
    });

    const user = await consumeLoginCode(
      "seller@example.com",
      "123456",
      repository,
      now,
    );

    expect(user).toBeNull();
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it("rejects a wrong code", async () => {
    const repository = createRepository({
      id: "code-1",
      email: "seller@example.com",
      codeHash: hashSecret("123456"),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
      consumedAt: null,
    });

    const user = await consumeLoginCode(
      "seller@example.com",
      "654321",
      repository,
      now,
    );

    expect(user).toBeNull();
    expect(repository.consume).not.toHaveBeenCalled();
    expect(repository.upsertUserByEmail).not.toHaveBeenCalled();
  });
});
