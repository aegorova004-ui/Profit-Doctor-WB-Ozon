import { bigintToSafeNumber } from "./decimal";
import type { AnalyzedReportRow, ReportAnalysis } from "./analyze-report";

export type ExpenseDriver =
  | "cost-of-goods"
  | "commission"
  | "logistics"
  | "storage"
  | "returns"
  | "penalties"
  | "advertising"
  | "other";

export type SkuDiagnosisStatus =
  "loss" | "positive" | "positive-estimate" | "missing-cost";

export type SkuDiagnosis = {
  sku: string;
  productName: string | null;
  status: SkuDiagnosisStatus;
  breakEvenGapKopecks: number;
  positiveBufferKopecks: number;
  maxAffordableCostOfGoodsKopecks: number;
  maxAffordableUnitCostKopecks: number | null;
  lossBeforeCostOfGoods: boolean;
  largestKnownExpense: {
    driver: ExpenseDriver;
    amountKopecks: number;
  } | null;
};

export type ReportDiagnosis = {
  totalLossKopecks: number;
  totalPositiveBufferKopecks: number;
  lossSkuCount: number;
  primaryLossSku: string | null;
  prioritySkus: string[];
  rows: SkuDiagnosis[];
};

function nonNegative(value: number | null): number {
  return value ?? 0;
}

function findLargestExpense(
  row: AnalyzedReportRow,
): SkuDiagnosis["largestKnownExpense"] {
  const expenses: Array<[ExpenseDriver, number]> = [
    ["cost-of-goods", nonNegative(row.profit.costOfGoodsKopecks)],
    ["commission", nonNegative(row.marketplaceCommissionKopecks)],
    ["logistics", nonNegative(row.logisticsKopecks)],
    ["storage", nonNegative(row.storageKopecks)],
    ["returns", nonNegative(row.returnsKopecks)],
    ["penalties", nonNegative(row.penaltiesKopecks)],
    ["advertising", nonNegative(row.advertisingKopecks)],
    ["other", nonNegative(row.otherExpensesKopecks)],
  ];

  const [driver, amountKopecks] = expenses.reduce(
    (largest, expense) => (expense[1] > largest[1] ? expense : largest),
    expenses[0],
  );

  return amountKopecks > 0 ? { driver, amountKopecks } : null;
}

function diagnoseRow(row: AnalyzedReportRow): SkuDiagnosis {
  const operatingProfit = BigInt(row.profit.operatingProfitKopecks);
  const revenue = BigInt(row.profit.revenueKopecks);
  const marketplaceExpenses = BigInt(row.profit.marketplaceExpensesKopecks);
  const affordableCostBeforeFloor = revenue - marketplaceExpenses;
  const affordableCost =
    affordableCostBeforeFloor > 0n ? affordableCostBeforeFloor : 0n;
  const breakEvenGap = operatingProfit < 0n ? -operatingProfit : 0n;
  const positiveBuffer = operatingProfit > 0n ? operatingProfit : 0n;
  const maxAffordableUnitCost =
    Number.isSafeInteger(row.quantity) && row.quantity > 0
      ? affordableCost / BigInt(row.quantity)
      : null;

  return {
    sku: row.sku,
    productName: row.productName,
    status: row.profit.isLoss
      ? "loss"
      : row.costOfGoodsSource === "missing"
        ? "missing-cost"
        : row.profit.isEstimate
          ? "positive-estimate"
          : "positive",
    breakEvenGapKopecks: bigintToSafeNumber(
      breakEvenGap,
      `breakEvenGapKopecks for ${row.sku}`,
    ),
    positiveBufferKopecks: bigintToSafeNumber(
      positiveBuffer,
      `positiveBufferKopecks for ${row.sku}`,
    ),
    maxAffordableCostOfGoodsKopecks: bigintToSafeNumber(
      affordableCost,
      `maxAffordableCostOfGoodsKopecks for ${row.sku}`,
    ),
    maxAffordableUnitCostKopecks:
      maxAffordableUnitCost === null
        ? null
        : bigintToSafeNumber(
            maxAffordableUnitCost,
            `maxAffordableUnitCostKopecks for ${row.sku}`,
          ),
    lossBeforeCostOfGoods: affordableCostBeforeFloor < 0n,
    largestKnownExpense: findLargestExpense(row),
  };
}

export function diagnoseReport(analysis: ReportAnalysis): ReportDiagnosis {
  const rows = analysis.rows.map(diagnoseRow);
  const priorities = rows
    .filter((row) => row.status === "loss")
    .sort(
      (left, right) =>
        right.breakEvenGapKopecks - left.breakEvenGapKopecks ||
        left.sku.localeCompare(right.sku),
    );
  const totals = rows.reduce(
    (result, row) => ({
      loss:
        result.loss +
        (row.status === "loss" ? BigInt(row.breakEvenGapKopecks) : 0n),
      positive:
        result.positive +
        (row.status === "positive" || row.status === "positive-estimate"
          ? BigInt(row.positiveBufferKopecks)
          : 0n),
    }),
    { loss: 0n, positive: 0n },
  );

  return {
    totalLossKopecks: bigintToSafeNumber(totals.loss, "totalLossKopecks"),
    totalPositiveBufferKopecks: bigintToSafeNumber(
      totals.positive,
      "totalPositiveBufferKopecks",
    ),
    lossSkuCount: priorities.length,
    primaryLossSku: priorities[0]?.sku ?? null,
    prioritySkus: priorities.map((row) => row.sku),
    rows,
  };
}
