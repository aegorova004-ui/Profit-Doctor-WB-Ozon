import {
  calculateProfit,
  type ProfitResult,
} from "../finance/calculate-profit";
import { bigintToSafeNumber } from "./decimal";
import type { NormalizedReportRow, ParsedReport } from "./parser";

export type AnalyzedReportRow = NormalizedReportRow & {
  profit: ProfitResult;
};

export type ReportAnalysis = {
  marketplace: ParsedReport["marketplace"];
  formatVersion: string;
  sourceRowCount: number;
  skuCount: number;
  totalRevenueKopecks: number;
  totalKnownExpensesKopecks: number;
  estimatedProfitKopecks: number;
  rows: AnalyzedReportRow[];
  missingColumns: string[];
  warnings: ParsedReport["warnings"];
};

function requireMoney(
  value: number | null,
  field: keyof NormalizedReportRow,
): number {
  if (value === null) {
    throw new RangeError(`${field} is required for report analysis`);
  }

  return value;
}

export function analyzeParsedReport(report: ParsedReport): ReportAnalysis {
  const rows = report.rows.map((row): AnalyzedReportRow => ({
    ...row,
    profit: calculateProfit({
      revenueKopecks: requireMoney(row.revenueKopecks, "revenueKopecks"),
      marketplaceCommissionKopecks: row.marketplaceCommissionKopecks,
      logisticsKopecks: row.logisticsKopecks,
      storageKopecks: row.storageKopecks,
      returnsKopecks: row.returnsKopecks,
      penaltiesKopecks: row.penaltiesKopecks,
      advertisingKopecks: row.advertisingKopecks,
      costOfGoodsKopecks: row.costOfGoodsKopecks,
      otherExpensesKopecks: row.otherExpensesKopecks,
    }),
  }));

  const totals = rows.reduce(
    (result, row) => ({
      revenue: result.revenue + BigInt(row.profit.revenueKopecks),
      expenses: result.expenses + BigInt(row.profit.marketplaceExpensesKopecks),
      profit: result.profit + BigInt(row.profit.operatingProfitKopecks),
    }),
    { revenue: 0n, expenses: 0n, profit: 0n },
  );

  return {
    marketplace: report.marketplace,
    formatVersion: report.formatVersion,
    sourceRowCount: report.sourceRowCount,
    skuCount: rows.length,
    totalRevenueKopecks: bigintToSafeNumber(
      totals.revenue,
      "totalRevenueKopecks",
    ),
    totalKnownExpensesKopecks: bigintToSafeNumber(
      totals.expenses,
      "totalKnownExpensesKopecks",
    ),
    estimatedProfitKopecks: bigintToSafeNumber(
      totals.profit,
      "estimatedProfitKopecks",
    ),
    rows,
    missingColumns: report.missingColumns,
    warnings: report.warnings,
  };
}
