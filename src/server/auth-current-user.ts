import type { AuthenticatedUser } from "./access-control";
import {
  SESSION_COOKIE_NAME,
  type SessionCookieOptions,
  getSessionCookieOptions,
} from "./auth-cookie";
import {
  type AuthSessionRepository,
  resolveCurrentUserFromSessionToken,
} from "./auth-session";

export type SessionCookieStore = {
  get(name: string): { value: string } | undefined;
};

export type CurrentUserSession = {
  user: AuthenticatedUser;
  cookieName: typeof SESSION_COOKIE_NAME;
  cookieOptions: SessionCookieOptions;
};

export function getSessionTokenFromCookies(
  cookies: SessionCookieStore,
): string | null {
  return cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function resolveCurrentUserFromCookies(
  cookies: SessionCookieStore,
  repository: AuthSessionRepository,
  now = new Date(),
): Promise<CurrentUserSession | null> {
  const user = await resolveCurrentUserFromSessionToken(
    getSessionTokenFromCookies(cookies),
    repository,
    now,
  );

  if (!user) {
    return null;
  }

  return {
    user,
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: getSessionCookieOptions(),
  };
}
