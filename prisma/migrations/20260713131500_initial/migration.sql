-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Enable case-insensitive email uniqueness
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('WILDBERRIES', 'OZON', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('UPLOADED', 'PARSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "telegramId" TEXT,
    "subscriptionPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceKopecks" INTEGER NOT NULL,
    "monthlyReportLimit" INTEGER,
    "reportRowLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ReportStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalFileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRow" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "offerId" TEXT,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(18,2),
    "marketplaceCommission" DECIMAL(18,2),
    "logistics" DECIMAL(18,2),
    "storage" DECIMAL(18,2),
    "returns" DECIMAL(18,2),
    "penalties" DECIMAL(18,2),
    "advertising" DECIMAL(18,2),
    "costOfGoods" DECIMAL(18,2),
    "otherExpenses" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductProfitSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "revenue" DECIMAL(18,2) NOT NULL,
    "marketplaceExpenses" DECIMAL(18,2) NOT NULL,
    "costOfGoods" DECIMAL(18,2),
    "grossProfit" DECIMAL(18,2),
    "operatingProfit" DECIMAL(18,2) NOT NULL,
    "marginPercent" DECIMAL(9,4),
    "roiPercent" DECIMAL(9,4),
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "isLoss" BOOLEAN NOT NULL DEFAULT false,
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductProfitSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE INDEX "UploadedReport_userId_createdAt_idx" ON "UploadedReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportRow_reportId_sku_idx" ON "ReportRow"("reportId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRow_reportId_sourceRowNumber_key" ON "ReportRow"("reportId", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "ProductProfitSnapshot_reportId_isLoss_idx" ON "ProductProfitSnapshot"("reportId", "isLoss");

-- CreateIndex
CREATE UNIQUE INDEX "ProductProfitSnapshot_reportId_sku_key" ON "ProductProfitSnapshot"("reportId", "sku");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedReport" ADD CONSTRAINT "UploadedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRow" ADD CONSTRAINT "ReportRow_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "UploadedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductProfitSnapshot" ADD CONSTRAINT "ProductProfitSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "UploadedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
