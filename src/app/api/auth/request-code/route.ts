import { NextResponse } from "next/server";

import {
  authRateLimitActionForEndpoint,
  createRateLimitSince,
  handleRequestLoginCode,
} from "@/server/auth-api";
import { createUnavailableLoginCodeDelivery } from "@/server/auth-delivery";
import { LOGIN_CODE_REQUEST_RATE_LIMIT } from "@/server/auth-rate-limit";
import { createPrismaAuthRepository } from "@/server/auth-prisma-repository";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const repository = createPrismaAuthRepository(prisma);

  const result = await handleRequestLoginCode(await readJson(request), {
    repository,
    delivery: createUnavailableLoginCodeDelivery(),
    loadRequestRateLimitEvents: (email, now) =>
      repository.findAuthRateLimitEvents({
        email,
        action: authRateLimitActionForEndpoint("request-code"),
        since: createRateLimitSince(
          now,
          LOGIN_CODE_REQUEST_RATE_LIMIT.windowSeconds,
        ),
      }),
    loadVerifyRateLimitEvents: async () => [],
    recordRequestRateLimitEvent: (email, createdAt) =>
      repository.createAuthRateLimitEvent({
        email,
        action: authRateLimitActionForEndpoint("request-code"),
        createdAt,
      }),
  });

  return NextResponse.json(result.response.body, {
    status: result.response.status,
  });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
