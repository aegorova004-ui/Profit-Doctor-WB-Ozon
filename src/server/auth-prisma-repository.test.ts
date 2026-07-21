import { describe, expect, it, vi } from "vitest";

import {
  type AuthPrismaClient,
  createPrismaAuthRepository,
} from "./auth-prisma-repository";

function createPrismaMock(): AuthPrismaClient {
  return {
    loginCode: {
      create: vi.fn(async () => undefined),
      findFirst: vi.fn(async () => ({
        id: "code-1",
        email: "seller@example.com",
        codeHash: "hash",
        expiresAt: new Date("2026-07-21T10:10:00.000Z"),
        consumedAt: null,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    user: {
      upsert: vi.fn(async () => ({
        id: "user-1",
        email: "seller@example.com",
      })),
    },
    authSession: {
      findUnique: vi.fn(async () => ({
        tokenHash: "token-hash",
        expiresAt: new Date("2026-08-20T10:00:00.000Z"),
        revokedAt: null,
        user: { id: "user-1", email: "seller@example.com" },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async () => undefined),
    },
    authRateLimitEvent: {
      findMany: vi.fn(async () => [
        { createdAt: new Date("2026-07-21T10:00:00.000Z") },
      ]),
      create: vi.fn(async () => undefined),
    },
  };
}

describe("createPrismaAuthRepository", () => {
  it("creates login codes without plaintext code", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const expiresAt = new Date("2026-07-21T10:10:00.000Z");

    await repository.createLoginCode({
      email: "seller@example.com",
      codeHash: "hash",
      expiresAt,
    });

    expect(prisma.loginCode.create).toHaveBeenCalledWith({
      data: {
        email: "seller@example.com",
        codeHash: "hash",
        expiresAt,
      },
    });
  });

  it("loads the latest login code by normalized email", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);

    await repository.findLatestByEmail("seller@example.com");

    expect(prisma.loginCode.findFirst).toHaveBeenCalledWith({
      where: { email: "seller@example.com" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        codeHash: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  });

  it("consumes login codes only when they are still unconsumed", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const consumedAt = new Date("2026-07-21T10:05:00.000Z");

    await repository.consume("code-1", consumedAt);

    expect(prisma.loginCode.updateMany).toHaveBeenCalledWith({
      where: { id: "code-1", consumedAt: null },
      data: { consumedAt },
    });
  });

  it("upserts users by email and selects only auth user fields", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);

    const user = await repository.upsertUserByEmail("seller@example.com");

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: "seller@example.com" },
      update: {},
      create: { email: "seller@example.com" },
      select: { id: true, email: true },
    });
    expect(user).toEqual({ id: "user-1", email: "seller@example.com" });
  });

  it("loads auth sessions by token hash with minimal user fields", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);

    await repository.findByTokenHash("token-hash");

    expect(prisma.authSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: "token-hash" },
      select: {
        tokenHash: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true } },
      },
    });
  });

  it("marks sessions used without touching revoked sessions", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const usedAt = new Date("2026-07-21T10:06:00.000Z");

    await repository.markUsed("token-hash", usedAt);

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: "token-hash", revokedAt: null },
      data: { lastUsedAt: usedAt },
    });
  });

  it("creates auth sessions by user id and token hash", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const expiresAt = new Date("2026-08-20T10:00:00.000Z");

    await repository.createAuthSession({
      userId: "user-1",
      tokenHash: "token-hash",
      expiresAt,
    });

    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: "token-hash",
        expiresAt,
      },
    });
  });

  it("revokes auth sessions without changing already revoked sessions", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const revokedAt = new Date("2026-07-21T10:07:00.000Z");

    await repository.revokeAuthSession("token-hash", revokedAt);

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: "token-hash", revokedAt: null },
      data: { revokedAt },
    });
  });

  it("loads auth rate-limit events by email, action and lower bound", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const since = new Date("2026-07-21T09:45:00.000Z");

    const events = await repository.findAuthRateLimitEvents({
      email: "seller@example.com",
      action: "request_code",
      since,
    });

    expect(prisma.authRateLimitEvent.findMany).toHaveBeenCalledWith({
      where: {
        email: "seller@example.com",
        action: "REQUEST_CODE",
        createdAt: { gt: since },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    expect(events).toEqual([
      { createdAt: new Date("2026-07-21T10:00:00.000Z") },
    ]);
  });

  it("creates auth rate-limit events without storing IP or user agent", async () => {
    const prisma = createPrismaMock();
    const repository = createPrismaAuthRepository(prisma);
    const createdAt = new Date("2026-07-21T10:00:00.000Z");

    await repository.createAuthRateLimitEvent({
      email: "seller@example.com",
      action: "verify_code",
      createdAt,
    });

    expect(prisma.authRateLimitEvent.create).toHaveBeenCalledWith({
      data: {
        email: "seller@example.com",
        action: "VERIFY_CODE",
        createdAt,
      },
    });
  });
});
