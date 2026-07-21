import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { handleGetCurrentUser } from "@/server/auth-current-user-api";
import { createPrismaAuthRepository } from "@/server/auth-prisma-repository";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

export async function GET() {
  const result = await handleGetCurrentUser(
    await cookies(),
    createPrismaAuthRepository(prisma),
  );

  return NextResponse.json(result.body, { status: result.status });
}
