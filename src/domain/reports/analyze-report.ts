import {
  calculateProfit,
  type ProfitResult,
} from "../finance/calculate-profit";
import { bigintToSafeNumber } from "./decimal";
import type { NormalizedReportRow, ParsedReport } from "./parser";

export type AnalyzedReportRow = NormalizedReportRow & {
  unitCostKopecks: number | null;
  costOfGoodsSource: "user-unit-cost" | "report" | "missing";
  profit: ProfitResult;
};

export type UnitCostsBySku = Readonly<Record<string, number>>;

export type ReportAnalysis = {
  marketplace: ParsedReport["marketplace"];
  formatVersion: string;
  sourceRowCount: number;
  skuCount: number;
  totalRevenueKopecks: number;
  totalKnownExpensesKopecks: number;
  totalKnownCostOfGoodsKopecks: number;
  estimatedProfitKopecks: number;
  missingCostSkuCount: number;
  lossSkuCount: number;
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

function assertUnitCost(value: number, sku: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `unit cost for ${sku} must be a non-negative safe integer number of kopecks`,
    );
  }
}

function resolveCostOfGoods(
  row: NormalizedReportRow,
  unitCostsBySku: UnitCostsBySku,
): Pick<
  AnalyzedReportRow,
  "unitCostKopecks" | "costOfGoodsKopecks" | "costOfGoodsSource"
> {
  if (Object.prototype.hasOwnProperty.call(unitCostsBySku, row.sku)) {
    const unitCostKopecks = unitCostsBySku[row.sku];
    assertUnitCost(unitCostKopecks, row.sku);

    if (!Number.isSafeInteger(row.quantity) || row.quantity <= 0) {
      throw new RangeError(
        `unit cost for ${row.sku} requires a positive integer quantity`,
      );
    }

    return {
      unitCostKopecks,
      costOfGoodsKopecks: bigintToSafeNumber(
        BigInt(unitCostKopecks) * BigInt(row.quantity),
        `costOfGoodsKopecks for ${row.sku}`,
      ),
      costOfGoodsSource: "user-unit-cost",
    };
  }

  if (row.costOfGoodsKopecks !== null) {
    return {
      unitCostKopecks: null,
      costOfGoodsKopecks: row.costOfGoodsKopecks,
      costOfGoodsSource: "report",
    };
  }

  return {
    unitCostKopecks: null,
    costOfGoodsKopecks: null,
    costOfGoodsSource: "missing",
  };
}

export function analyzeParsedReport(
  report: ParsedReport,
  unitCostsBySku: UnitCostsBySku = {},
): ReportAnalysis {
  const rows = report.rows.map((row): AnalyzedReportRow => {
    const cost = resolveCostOfGoods(row, unitCostsBySku);

    return {
      ...row,
      ...cost,
      profit: calculateProfit({
        revenueKopecks: requireMoney(row.revenueKopecks, "revenueKopecks"),
        marketplaceCommissionKopecks: row.marketplaceCommissionKopecks,
        logisticsKopecks: row.logisticsKopecks,
        storageKopecks: row.storageKopecks,
        returnsKopecks: row.returnsKopecks,
        penaltiesKopecks: row.penaltiesKopecks,
        advertisingKopecks: row.advertisingKopecks,
        costOfGoodsKopecks: cost.costOfGoodsKopecks,
        otherExpensesKopecks: row.otherExpensesKopecks,
      }),
    };
  });

  const totals = rows.reduce(
    (result, row) => ({
      revenue: result.revenue + BigInt(row.profit.revenueKopecks),
      expenses: result.expenses + BigInt(row.profit.marketplaceExpensesKopecks),
      costOfGoods:
        result.costOfGoods + BigInt(row.profit.costOfGoodsKopecks ?? 0),
      profit: result.profit + BigInt(row.profit.operatingProfitKopecks),
    }),
    { revenue: 0n, expenses: 0n, costOfGoods: 0n, profit: 0n },
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
    totalKnownCostOfGoodsKopecks: bigintToSafeNumber(
      totals.costOfGoods,
      "totalKnownCostOfGoodsKopecks",
    ),
    estimatedProfitKopecks: bigintToSafeNumber(
      totals.profit,
      "estimatedProfitKopecks",
    ),
    missingCostSkuCount: rows.filter(
      (row) => row.costOfGoodsSource === "missing",
    ).length,
    lossSkuCount: rows.filter((row) => row.profit.isLoss).length,
    rows,
    missingColumns: report.missingColumns,
    warnings: report.warnings,
  };
}
