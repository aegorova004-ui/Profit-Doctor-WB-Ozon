import type { AuthenticatedUser } from "./access-control";
import type { AuthPrismaRepository } from "./auth-prisma-repository";
import { consumeLoginCode, issueLoginCode } from "./auth-login-code";
import { addMinutes, generateSessionToken, hashSecret } from "./auth-tokens";

const SESSION_TTL_MINUTES = 60 * 24 * 30;

export type LoginCodeDelivery = {
  sendLoginCode(input: {
    email: string;
    code: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type RequestLoginCodeResult = {
  ok: true;
  email: string;
  expiresAt: Date;
};

export type VerifyLoginCodeResult =
  | {
      ok: true;
      user: AuthenticatedUser;
      sessionToken: string;
      sessionExpiresAt: Date;
    }
  | {
      ok: false;
      reason: "invalid_code";
    };

export async function requestLoginCode(
  rawEmail: string,
  repository: AuthPrismaRepository,
  delivery: LoginCodeDelivery,
  now = new Date(),
): Promise<RequestLoginCodeResult> {
  const loginCode = await issueLoginCode(rawEmail, repository, now);

  await delivery.sendLoginCode(loginCode);

  return {
    ok: true,
    email: loginCode.email,
    expiresAt: loginCode.expiresAt,
  };
}

export async function verifyLoginCodeAndCreateSession(
  rawEmail: string,
  rawCode: string,
  repository: AuthPrismaRepository,
  now = new Date(),
): Promise<VerifyLoginCodeResult> {
  const user = await consumeLoginCode(rawEmail, rawCode, repository, now);

  if (!user) {
    return { ok: false, reason: "invalid_code" };
  }

  const sessionToken = generateSessionToken();
  const sessionExpiresAt = addMinutes(now, SESSION_TTL_MINUTES);

  await repository.createAuthSession({
    userId: user.id,
    tokenHash: hashSecret(sessionToken),
    expiresAt: sessionExpiresAt,
  });

  return {
    ok: true,
    user,
    sessionToken,
    sessionExpiresAt,
  };
}
