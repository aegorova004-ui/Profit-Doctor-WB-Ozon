import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { handleLogout } from "@/server/auth-logout";
import { createPrismaAuthRepository } from "@/server/auth-prisma-repository";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

export async function POST() {
  const result = await handleLogout(
    await cookies(),
    createPrismaAuthRepository(prisma),
  );
  const response = NextResponse.json(result.response.body, {
    status: result.response.status,
  });

  response.cookies.set(
    result.expiredCookie.name,
    result.expiredCookie.value,
    result.expiredCookie.options,
  );

  return response;
}
