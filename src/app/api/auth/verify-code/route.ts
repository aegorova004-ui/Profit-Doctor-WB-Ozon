import { NextResponse } from "next/server";

import { handleVerifyLoginCode } from "@/server/auth-api";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/server/auth-cookie";
import { createUnavailableLoginCodeDelivery } from "@/server/auth-delivery";
import {
  getAuthRateLimitEvents,
  recordAuthRateLimitEvent,
} from "@/server/auth-memory-rate-limit";
import { createPrismaAuthRepository } from "@/server/auth-prisma-repository";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await handleVerifyLoginCode(await readJson(request), {
    repository: createPrismaAuthRepository(prisma),
    delivery: createUnavailableLoginCodeDelivery(),
    loadRequestRateLimitEvents: async (email, now) =>
      getAuthRateLimitEvents("request_code", email, now),
    loadVerifyRateLimitEvents: async (email, now) =>
      getAuthRateLimitEvents("verify_code", email, now),
    recordVerifyRateLimitEvent: (email, createdAt) =>
      recordAuthRateLimitEvent("verify_code", email, createdAt),
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
