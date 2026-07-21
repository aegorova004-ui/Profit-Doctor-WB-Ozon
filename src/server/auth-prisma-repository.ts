import type { AuthSessionRecord, AuthSessionRepository } from "./auth-session";
import type {
  AuthRateLimitAction,
  AuthRateLimitEvent,
} from "./auth-rate-limit";
import type {
  CreateLoginCodeRepository,
  LoginCodeRecord,
  LoginCodeRepository,
  UserRecord,
} from "./auth-login-code";

export type AuthPrismaClient = {
  loginCode: {
    create(input: {
      data: {
        email: string;
        codeHash: string;
        expiresAt: Date;
      };
    }): Promise<unknown>;
    findFirst(input: {
      where: { email: string };
      orderBy: { createdAt: "desc" };
      select: {
        id: true;
        email: true;
        codeHash: true;
        expiresAt: true;
        consumedAt: true;
      };
    }): Promise<LoginCodeRecord | null>;
    updateMany(input: {
      where: { id: string; consumedAt: null };
      data: { consumedAt: Date };
    }): Promise<unknown>;
  };
  user: {
    upsert(input: {
      where: { email: string };
      update: Record<string, never>;
      create: { email: string };
      select: { id: true; email: true };
    }): Promise<UserRecord>;
  };
  authSession: {
    findUnique(input: {
      where: { tokenHash: string };
      select: {
        tokenHash: true;
        expiresAt: true;
        revokedAt: true;
        user: { select: { id: true; email: true } };
      };
    }): Promise<AuthSessionRecord | null>;
    updateMany(input: {
      where: { tokenHash: string; revokedAt: null };
      data: { lastUsedAt: Date } | { revokedAt: Date };
    }): Promise<unknown>;
    create(input: {
      data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
      };
    }): Promise<unknown>;
  };
  authRateLimitEvent: {
    findMany(input: {
      where: {
        email: string;
        action: PrismaAuthRateLimitAction;
        createdAt: { gt: Date };
      };
      orderBy: { createdAt: "asc" };
      select: { createdAt: true };
    }): Promise<AuthRateLimitEvent[]>;
    create(input: {
      data: {
        email: string;
        action: PrismaAuthRateLimitAction;
        createdAt: Date;
      };
    }): Promise<unknown>;
  };
};

type PrismaAuthRateLimitAction = "REQUEST_CODE" | "VERIFY_CODE";

export type AuthPrismaRepository = LoginCodeRepository &
  CreateLoginCodeRepository &
  AuthSessionRepository & {
    createAuthSession(input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    }): Promise<void>;
    revokeAuthSession(tokenHash: string, revokedAt: Date): Promise<void>;
    findAuthRateLimitEvents(input: {
      email: string;
      action: AuthRateLimitAction;
      since: Date;
    }): Promise<AuthRateLimitEvent[]>;
    createAuthRateLimitEvent(input: {
      email: string;
      action: AuthRateLimitAction;
      createdAt: Date;
    }): Promise<void>;
  };

export function createPrismaAuthRepository(
  prisma: AuthPrismaClient,
): AuthPrismaRepository {
  return {
    async createLoginCode(input) {
      await prisma.loginCode.create({
        data: {
          email: input.email,
          codeHash: input.codeHash,
          expiresAt: input.expiresAt,
        },
      });
    },

    findLatestByEmail(email) {
      return prisma.loginCode.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          codeHash: true,
          expiresAt: true,
          consumedAt: true,
        },
      });
    },

    async consume(codeId, consumedAt) {
      await prisma.loginCode.updateMany({
        where: { id: codeId, consumedAt: null },
        data: { consumedAt },
      });
    },

    upsertUserByEmail(email) {
      return prisma.user.upsert({
        where: { email },
        update: {},
        create: { email },
        select: { id: true, email: true },
      });
    },

    findByTokenHash(tokenHash) {
      return prisma.authSession.findUnique({
        where: { tokenHash },
        select: {
          tokenHash: true,
          expiresAt: true,
          revokedAt: true,
          user: { select: { id: true, email: true } },
        },
      });
    },

    async markUsed(tokenHash, usedAt) {
      await prisma.authSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { lastUsedAt: usedAt },
      });
    },

    async createAuthSession(input) {
      await prisma.authSession.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
    },

    async revokeAuthSession(tokenHash, revokedAt) {
      await prisma.authSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt },
      });
    },

    findAuthRateLimitEvents(input) {
      return prisma.authRateLimitEvent.findMany({
        where: {
          email: input.email,
          action: toPrismaRateLimitAction(input.action),
          createdAt: { gt: input.since },
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
    },

    async createAuthRateLimitEvent(input) {
      await prisma.authRateLimitEvent.create({
        data: {
          email: input.email,
          action: toPrismaRateLimitAction(input.action),
          createdAt: input.createdAt,
        },
      });
    },
  };
}

function toPrismaRateLimitAction(
  action: AuthRateLimitAction,
): PrismaAuthRateLimitAction {
  switch (action) {
    case "request_code":
      return "REQUEST_CODE";
    case "verify_code":
      return "VERIFY_CODE";
  }
}
