import { describe, expect, it, vi } from "vitest";

import type { LoginCodeDeliveryProvider } from "./auth-delivery";
import { createUnavailableLoginCodeDelivery } from "./auth-delivery";
import {
  authRateLimitActionForEndpoint,
  createRateLimitSince,
  handleRequestLoginCode,
  handleVerifyLoginCode,
} from "./auth-api";
import type { AuthPrismaRepository } from "./auth-prisma-repository";
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
    revokeAuthSession: vi.fn(async () => undefined),
    findAuthRateLimitEvents: vi.fn(async () => []),
    createAuthRateLimitEvent: vi.fn(async () => undefined),
  };
}

function createDelivery(): LoginCodeDeliveryProvider {
  return {
    available: true,
    sendLoginCode: vi.fn(async () => undefined),
  };
}

function createDependencies(
  overrides: Partial<Parameters<typeof handleRequestLoginCode>[1]> = {},
): Parameters<typeof handleRequestLoginCode>[1] {
  return {
    repository: createRepository(),
    delivery: createDelivery(),
    now: () => new Date("2026-07-21T10:00:00.000Z"),
    loadRequestRateLimitEvents: vi.fn(async () => []),
    loadVerifyRateLimitEvents: vi.fn(async () => []),
    recordRequestRateLimitEvent: vi.fn(async () => undefined),
    recordVerifyRateLimitEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("handleRequestLoginCode", () => {
  it("rejects invalid payload before repository calls", async () => {
    const repository = createRepository();

    await expect(
      handleRequestLoginCode("bad", createDependencies({ repository })),
    ).resolves.toEqual({
      response: {
        status: 400,
        body: {
          ok: false,
          error: "email_required",
          message: "Введите email.",
        },
      },
    });
    expect(repository.createLoginCode).not.toHaveBeenCalled();
  });

  it("does not create login codes while delivery is unavailable", async () => {
    const repository = createRepository();

    await expect(
      handleRequestLoginCode(
        { email: "seller@example.com" },
        createDependencies({
          repository,
          delivery: createUnavailableLoginCodeDelivery(),
        }),
      ),
    ).resolves.toEqual({
      response: {
        status: 503,
        body: {
          ok: false,
          error: "delivery_unavailable",
          message: "Отправка кода пока не подключена. Попробуйте позже.",
        },
      },
    });
    expect(repository.createLoginCode).not.toHaveBeenCalled();
  });

  it("returns public retry delay when request limit is exceeded", async () => {
    await expect(
      handleRequestLoginCode(
        { email: "seller@example.com" },
        createDependencies({
          loadRequestRateLimitEvents: vi.fn(async () => [
            { createdAt: new Date("2026-07-21T09:46:00.000Z") },
            { createdAt: new Date("2026-07-21T09:50:00.000Z") },
            { createdAt: new Date("2026-07-21T09:59:00.000Z") },
          ]),
        }),
      ),
    ).resolves.toEqual({
      response: {
        status: 429,
        body: {
          ok: false,
          error: "rate_limited",
          message: "Слишком много попыток. Попробуйте позже.",
          retryAfterSeconds: 60,
        },
      },
    });
  });

  it("creates and sends login code through configured delivery", async () => {
    const dependencies = createDependencies();

    await expect(
      handleRequestLoginCode({ email: " Seller@Example.COM " }, dependencies),
    ).resolves.toEqual({
      response: {
        status: 200,
        body: {
          ok: true,
          message: "Код отправлен. Проверьте почту.",
        },
      },
    });
    expect(dependencies.recordRequestRateLimitEvent).toHaveBeenCalledWith(
      "seller@example.com",
      new Date("2026-07-21T10:00:00.000Z"),
    );
    expect(dependencies.delivery.sendLoginCode).toHaveBeenCalledWith({
      email: "seller@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresAt: new Date("2026-07-21T10:10:00.000Z"),
    });
  });
});

describe("handleVerifyLoginCode", () => {
  it("returns invalid_code without exposing exact failure reason", async () => {
    const repository = createRepository();
    vi.mocked(repository.findLatestByEmail).mockResolvedValue(null);

    await expect(
      handleVerifyLoginCode(
        { email: "seller@example.com", code: "123456" },
        createDependencies({ repository }),
      ),
    ).resolves.toEqual({
      response: {
        status: 401,
        body: {
          ok: false,
          error: "invalid_code",
          message: "Код не подошёл. Проверьте письмо или запросите новый код.",
        },
      },
    });
    expect(repository.createAuthSession).not.toHaveBeenCalled();
  });

  it("returns session cookie metadata without exposing token in response body", async () => {
    const result = await handleVerifyLoginCode(
      { email: "seller@example.com", code: "123456" },
      createDependencies(),
    );

    expect(result.response).toEqual({
      status: 200,
      body: {
        ok: true,
        message: "Вход выполнен.",
      },
    });
    expect(result.sessionCookie?.value).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    expect(result.sessionCookie?.expiresAt).toEqual(
      new Date("2026-08-20T10:00:00.000Z"),
    );
  });
});

describe("auth API rate-limit route helpers", () => {
  it("calculates durable lookup lower bound from the policy window", () => {
    expect(
      createRateLimitSince(new Date("2026-07-21T10:15:00.000Z"), 900),
    ).toEqual(new Date("2026-07-21T10:00:00.000Z"));
  });

  it("maps endpoints to durable rate-limit actions", () => {
    expect(authRateLimitActionForEndpoint("request-code")).toBe("request_code");
    expect(authRateLimitActionForEndpoint("verify-code")).toBe("verify_code");
  });
});
