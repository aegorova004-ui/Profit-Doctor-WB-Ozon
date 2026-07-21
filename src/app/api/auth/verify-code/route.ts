import { NextResponse } from "next/server";

import {
  authRateLimitActionForEndpoint,
  createRateLimitSince,
  handleVerifyLoginCode,
} from "@/server/auth-api";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/server/auth-cookie";
import { createUnavailableLoginCodeDelivery } from "@/server/auth-delivery";
import { LOGIN_CODE_VERIFY_RATE_LIMIT } from "@/server/auth-rate-limit";
import { createPrismaAuthRepository } from "@/server/auth-prisma-repository";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const repository = createPrismaAuthRepository(prisma);

  const result = await handleVerifyLoginCode(await readJson(request), {
    repository,
    delivery: createUnavailableLoginCodeDelivery(),
    loadRequestRateLimitEvents: async () => [],
    loadVerifyRateLimitEvents: (email, now) =>
      repository.findAuthRateLimitEvents({
        email,
        action: authRateLimitActionForEndpoint("verify-code"),
        since: createRateLimitSince(
          now,
          LOGIN_CODE_VERIFY_RATE_LIMIT.windowSeconds,
        ),
      }),
    recordVerifyRateLimitEvent: (email, createdAt) =>
      repository.createAuthRateLimitEvent({
        email,
        action: authRateLimitActionForEndpoint("verify-code"),
        createdAt,
      }),
  });
  const response = NextResponse.json(result.response.body, {
    status: result.response.status,
  });

  if (result.sessionCookie) {
    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.sessionCookie.value,
      getSessionCookieOptions(),
    );
  }

  return response;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
