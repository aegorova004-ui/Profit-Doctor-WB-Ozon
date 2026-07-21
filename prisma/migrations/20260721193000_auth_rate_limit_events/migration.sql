-- CreateEnum
CREATE TYPE "AuthRateLimitAction" AS ENUM ('REQUEST_CODE', 'VERIFY_CODE');

-- CreateTable
CREATE TABLE "AuthRateLimitEvent" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "action" "AuthRateLimitAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthRateLimitEvent_email_action_createdAt_idx" ON "AuthRateLimitEvent"("email", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuthRateLimitEvent_createdAt_idx" ON "AuthRateLimitEvent"("createdAt");
