import type { SessionCookieStore } from "./auth-current-user";
import { getSessionTokenFromCookies } from "./auth-current-user";
import {
  SESSION_COOKIE_NAME,
  type ExpiredSessionCookieOptions,
  getExpiredSessionCookieOptions,
} from "./auth-cookie";
import { hashSecret } from "./auth-tokens";

export type AuthLogoutRepository = {
  revokeAuthSession(tokenHash: string, revokedAt: Date): Promise<void>;
};

export type AuthLogoutResult = {
  response: {
    status: 200;
    body: {
      ok: true;
      message: string;
    };
  };
  expiredCookie: {
    name: typeof SESSION_COOKIE_NAME;
    value: "";
    options: ExpiredSessionCookieOptions;
  };
};

export async function handleLogout(
  cookies: SessionCookieStore,
  repository: AuthLogoutRepository,
  now = new Date(),
): Promise<AuthLogoutResult> {
  const sessionToken = getSessionTokenFromCookies(cookies);

  if (sessionToken) {
    await repository.revokeAuthSession(hashSecret(sessionToken), now);
  }

  return {
    response: {
      status: 200,
      body: {
        ok: true,
        message: "Вы вышли из аккаунта.",
      },
    },
    expiredCookie: {
      name: SESSION_COOKIE_NAME,
      value: "",
      options: getExpiredSessionCookieOptions(),
    },
  };
}
