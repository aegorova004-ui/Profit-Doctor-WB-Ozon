import type { AuthRateLimitEvent } from "./auth-rate-limit";

type AuthRateLimitAction = "request_code" | "verify_code";

const RETENTION_SECONDS = 15 * 60;

const globalForAuthRateLimit = globalThis as typeof globalThis & {
  profitDoctorAuthRateLimitEvents?: Map<string, AuthRateLimitEvent[]>;
};

const authRateLimitEvents =
  globalForAuthRateLimit.profitDoctorAuthRateLimitEvents ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForAuthRateLimit.profitDoctorAuthRateLimitEvents = authRateLimitEvents;
}

export function getAuthRateLimitEvents(
  action: AuthRateLimitAction,
  email: string,
  now = new Date(),
): AuthRateLimitEvent[] {
  const key = toKey(action, email);
  const events = pruneEvents(authRateLimitEvents.get(key) ?? [], now);

  authRateLimitEvents.set(key, events);

  return events;
}

export function recordAuthRateLimitEvent(
  action: AuthRateLimitAction,
  email: string,
  createdAt = new Date(),
): void {
  const key = toKey(action, email);
  const events = pruneEvents(authRateLimitEvents.get(key) ?? [], createdAt);

  authRateLimitEvents.set(key, [...events, { createdAt }]);
}

export function clearAuthRateLimitEvents(): void {
  authRateLimitEvents.clear();
}

function pruneEvents(
  events: readonly AuthRateLimitEvent[],
  now: Date,
): AuthRateLimitEvent[] {
  const windowStartMs = now.getTime() - RETENTION_SECONDS * 1_000;

  return events.filter((event) => event.createdAt.getTime() > windowStartMs);
}

function toKey(action: AuthRateLimitAction, email: string): string {
  return `${action}:${email}`;
}
