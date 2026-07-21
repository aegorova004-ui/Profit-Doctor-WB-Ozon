import type { AuthenticatedUser } from "./access-control";
import { normalizeEmail } from "./access-control";
import {
  generateLoginCode,
  hashSecret,
  isExpired,
  verifySecret,
} from "./auth-tokens";

const DEFAULT_LOGIN_CODE_TTL_MINUTES = 10;

export type LoginCodeRecord = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type UserRecord = AuthenticatedUser;

export type LoginCodeRepository = {
  findLatestByEmail(email: string): Promise<LoginCodeRecord | null>;
  consume(codeId: string, consumedAt: Date): Promise<void>;
  upsertUserByEmail(email: string): Promise<UserRecord>;
};

export type CreateLoginCodeRepository = {
  createLoginCode(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type LoginCodeIssue = {
  email: string;
  code: string;
  expiresAt: Date;
};

export async function issueLoginCode(
  rawEmail: string,
  repository: CreateLoginCodeRepository,
  now = new Date(),
): Promise<LoginCodeIssue> {
  const email = normalizeEmail(rawEmail);
  const code = generateLoginCode();
  const expiresAt = new Date(
    now.getTime() + DEFAULT_LOGIN_CODE_TTL_MINUTES * 60_000,
  );

  await repository.createLoginCode({
    email,
    codeHash: hashSecret(code),
    expiresAt,
  });

  return { email, code, expiresAt };
}

export async function consumeLoginCode(
  rawEmail: string,
  rawCode: string,
  repository: LoginCodeRepository,
  now = new Date(),
): Promise<UserRecord | null> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();

  if (!code) {
    return null;
  }

  const loginCode = await repository.findLatestByEmail(email);

  if (
    !loginCode ||
    loginCode.consumedAt ||
    loginCode.email !== email ||
    !verifySecret(code, loginCode.codeHash) ||
    isExpired(loginCode.expiresAt, now)
  ) {
    return null;
  }

  await repository.consume(loginCode.id, now);

  return repository.upsertUserByEmail(email);
}
