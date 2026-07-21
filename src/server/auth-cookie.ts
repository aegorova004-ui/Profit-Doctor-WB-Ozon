const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const SESSION_COOKIE_NAME = "profit_doctor_session";

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export type ExpiredSessionCookieOptions = Omit<
  SessionCookieOptions,
  "maxAge"
> & {
  maxAge: 0;
};

export function getSessionCookieOptions(
  environment = process.env.NODE_ENV,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: environment === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getExpiredSessionCookieOptions(
  environment = process.env.NODE_ENV,
): ExpiredSessionCookieOptions {
  return {
    ...getSessionCookieOptions(environment),
    maxAge: 0,
  };
}
