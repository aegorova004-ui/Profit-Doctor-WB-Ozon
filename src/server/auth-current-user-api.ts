import type { AuthenticatedUser } from "./access-control";
import type { SessionCookieStore } from "./auth-current-user";
import { resolveCurrentUserFromCookies } from "./auth-current-user";
import type { AuthSessionRepository } from "./auth-session";

export type CurrentUserHttpResponseBody =
  | {
      ok: true;
      user: AuthenticatedUser;
    }
  | {
      ok: false;
      error: "unauthenticated";
      message: string;
    };

export type CurrentUserHttpResponse = {
  status: number;
  body: CurrentUserHttpResponseBody;
};

export async function handleGetCurrentUser(
  cookies: SessionCookieStore,
  repository: AuthSessionRepository,
  now = new Date(),
): Promise<CurrentUserHttpResponse> {
  const session = await resolveCurrentUserFromCookies(cookies, repository, now);

  if (!session) {
    return {
      status: 401,
      body: {
        ok: false,
        error: "unauthenticated",
        message: "Войдите в аккаунт.",
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      user: session.user,
    },
  };
}
