import type { AuthenticatedUser } from "./access-control";
import { hashSecret, isExpired } from "./auth-tokens";

export type AuthSessionRecord = {
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthenticatedUser;
};

export type AuthSessionRepository = {
  findByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  markUsed(tokenHash: string, usedAt: Date): Promise<void>;
};

export async function resolveCurrentUserFromSessionToken(
  sessionToken: string | null | undefined,
  repository: AuthSessionRepository,
  now = new Date(),
): Promise<AuthenticatedUser | null> {
  const token = sessionToken?.trim();

  if (!token) {
    return null;
  }

  const tokenHash = hashSecret(token);
  const session = await repository.findByTokenHash(tokenHash);

  if (!session || session.revokedAt || isExpired(session.expiresAt, now)) {
    return null;
  }

  await repository.markUsed(tokenHash, now);

  return session.user;
}
