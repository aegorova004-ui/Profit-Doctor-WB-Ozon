import type {
  AuthRateLimitAction,
  AuthRateLimitEvent,
} from "./auth-rate-limit";
import {
  LOGIN_CODE_REQUEST_RATE_LIMIT,
  LOGIN_CODE_VERIFY_RATE_LIMIT,
  checkAuthRateLimit,
} from "./auth-rate-limit";
import type { LoginCodeDeliveryProvider } from "./auth-delivery";
import type { AuthHttpResponse } from "./auth-http";
import { authError, authRateLimitError, authSuccess } from "./auth-http";
import { requestLoginCode, verifyLoginCodeAndCreateSession } from "./auth-flow";
import type { AuthPrismaRepository } from "./auth-prisma-repository";
import {
  validateLoginCodeRequestPayload,
  validateLoginCodeVerifyPayload,
} from "./auth-validation";

export type AuthApiDependencies = {
  repository: AuthPrismaRepository;
  delivery: LoginCodeDeliveryProvider;
  now?: () => Date;
  loadRequestRateLimitEvents(
    email: string,
    now: Date,
  ): Promise<AuthRateLimitEvent[]>;
  loadVerifyRateLimitEvents(
    email: string,
    now: Date,
  ): Promise<AuthRateLimitEvent[]>;
  recordRequestRateLimitEvent?(
    email: string,
    createdAt: Date,
  ): Promise<void> | void;
  recordVerifyRateLimitEvent?(
    email: string,
    createdAt: Date,
  ): Promise<void> | void;
};

export type AuthApiResult = {
  response: AuthHttpResponse;
  sessionCookie?: {
    value: string;
    expiresAt: Date;
  };
};

export function createRateLimitSince(now: Date, windowSeconds: number): Date {
  return new Date(now.getTime() - windowSeconds * 1_000);
}

export function authRateLimitActionForEndpoint(
  endpoint: "request-code" | "verify-code",
): AuthRateLimitAction {
  return endpoint === "request-code" ? "request_code" : "verify_code";
}

export async function handleRequestLoginCode(
  payload: unknown,
  dependencies: AuthApiDependencies,
): Promise<AuthApiResult> {
  const input = validateLoginCodeRequestPayload(payload);

  if (!input.ok) {
    return { response: authError(input.error) };
  }

  if (!dependencies.delivery.available) {
    return { response: authError("delivery_unavailable") };
  }

  const now = dependencies.now?.() ?? new Date();
  const rateLimit = checkAuthRateLimit(
    await dependencies.loadRequestRateLimitEvents(input.value.email, now),
    LOGIN_CODE_REQUEST_RATE_LIMIT,
    now,
  );

  if (!rateLimit.allowed) {
    return { response: authRateLimitError(rateLimit) };
  }

  await dependencies.recordRequestRateLimitEvent?.(input.value.email, now);
  await requestLoginCode(
    input.value.email,
    dependencies.repository,
    dependencies.delivery,
    now,
  );

  return {
    response: authSuccess("Код отправлен. Проверьте почту."),
  };
}

export async function handleVerifyLoginCode(
  payload: unknown,
  dependencies: AuthApiDependencies,
): Promise<AuthApiResult> {
  const input = validateLoginCodeVerifyPayload(payload);

  if (!input.ok) {
    return { response: authError(input.error) };
  }

  const now = dependencies.now?.() ?? new Date();
  const rateLimit = checkAuthRateLimit(
    await dependencies.loadVerifyRateLimitEvents(input.value.email, now),
    LOGIN_CODE_VERIFY_RATE_LIMIT,
    now,
  );

  if (!rateLimit.allowed) {
    return { response: authRateLimitError(rateLimit) };
  }

  await dependencies.recordVerifyRateLimitEvent?.(input.value.email, now);

  const result = await verifyLoginCodeAndCreateSession(
    input.value.email,
    input.value.code,
    dependencies.repository,
    now,
  );

  if (!result.ok) {
    return { response: authError("invalid_code") };
  }

  return {
    response: authSuccess("Вход выполнен."),
    sessionCookie: {
      value: result.sessionToken,
      expiresAt: result.sessionExpiresAt,
    },
  };
}
