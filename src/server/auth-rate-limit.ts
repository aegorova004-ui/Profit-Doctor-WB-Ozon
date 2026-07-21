const DEFAULT_WINDOW_SECONDS = 15 * 60;

export type AuthRateLimitEvent = {
  createdAt: Date;
};

export type AuthRateLimitAction = "request_code" | "verify_code";

export type AuthRateLimitPolicy = {
  maxAttempts: number;
  windowSeconds?: number;
};

export type AuthRateLimitDecision =
  | {
      allowed: true;
      remainingAttempts: number;
      retryAfterSeconds: 0;
    }
  | {
      allowed: false;
      remainingAttempts: 0;
      retryAfterSeconds: number;
    };

export const LOGIN_CODE_REQUEST_RATE_LIMIT: Required<AuthRateLimitPolicy> = {
  maxAttempts: 3,
  windowSeconds: DEFAULT_WINDOW_SECONDS,
};

export const LOGIN_CODE_VERIFY_RATE_LIMIT: Required<AuthRateLimitPolicy> = {
  maxAttempts: 5,
  windowSeconds: DEFAULT_WINDOW_SECONDS,
};

export function checkAuthRateLimit(
  events: readonly AuthRateLimitEvent[],
  policy: AuthRateLimitPolicy,
  now = new Date(),
): AuthRateLimitDecision {
  const maxAttempts = assertPositiveInteger(policy.maxAttempts, "maxAttempts");
  const windowSeconds = assertPositiveInteger(
    policy.windowSeconds ?? DEFAULT_WINDOW_SECONDS,
    "windowSeconds",
  );
  const windowStartMs = now.getTime() - windowSeconds * 1_000;
  const eventsInWindow = events
    .filter((event) => event.createdAt.getTime() > windowStartMs)
    .sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
  const remainingAttempts = Math.max(0, maxAttempts - eventsInWindow.length);

  if (eventsInWindow.length < maxAttempts) {
    return {
      allowed: true,
      remainingAttempts,
      retryAfterSeconds: 0,
    };
  }

  const oldestEvent = eventsInWindow[0];
  const retryAtMs = oldestEvent.createdAt.getTime() + windowSeconds * 1_000;

  return {
    allowed: false,
    remainingAttempts: 0,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((retryAtMs - now.getTime()) / 1_000),
    ),
  };
}

function assertPositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer`);
  }

  return value;
}
