import { NextResponse } from "next/server";

import { handleRequestLoginCode } from "@/server/auth-api";
import { createUnavailableLoginCodeDelivery } from "@/server/auth-delivery";
import {
  getAuthRateLimitEvents,
  recordAuthRateLimitEvent,
} from "@/server/auth-memory-rate-limit";
import { createPrismaAuthRepository } from "@/server/auth-prisma-repository";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await handleRequestLoginCode(await readJson(request), {
    repository: createPrismaAuthRepository(prisma),
    delivery: createUnavailableLoginCodeDelivery(),
    loadRequestRateLimitEvents: async (email, now) =>
      getAuthRateLimitEvents("request_code", email, now),
    loadVerifyRateLimitEvents: async (email, now) =>
      getAuthRateLimitEvents("verify_code", email, now),
    recordRequestRateLimitEvent: (email, createdAt) =>
      recordAuthRateLimitEvent("request_code", email, createdAt),
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
