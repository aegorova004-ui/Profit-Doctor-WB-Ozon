import { describe, expect, it } from "vitest";
import { analyzeParsedReport } from "./analyze-report";
import type { ParsedReport } from "./parser";

const report: ParsedReport = {
  marketplace: "wildberries",
  formatVersion: "test",
  sourceRowCount: 2,
  warnings: [],
  missingColumns: ["advertisingKopecks", "costOfGoodsKopecks"],
  rows: [
    {
      sourceRowNumber: 2,
      sku: "SKU-1",
      offerId: "1",
      productName: "Товар",
      quantity: 1,
      revenueKopecks: 100_000,
      marketplaceCommissionKopecks: 20_000,
      logisticsKopecks: 5_000,
      storageKopecks: 1_000,
      returnsKopecks: 0,
      penaltiesKopecks: 0,
      advertisingKopecks: null,
      costOfGoodsKopecks: null,
      otherExpensesKopecks: 0,
    },
  ],
};

describe("analyzeParsedReport", () => {
  it("calculates a traceable estimate from normalized SKU rows", () => {
    expect(analyzeParsedReport(report)).toMatchObject({
      sourceRowCount: 2,
      skuCount: 1,
      totalRevenueKopecks: 100_000,
      totalKnownExpensesKopecks: 26_000,
      totalKnownCostOfGoodsKopecks: 0,
      estimatedProfitKopecks: 74_000,
      missingCostSkuCount: 1,
      lossSkuCount: 0,
      missingColumns: ["advertisingKopecks", "costOfGoodsKopecks"],
      rows: [
        {
          sku: "SKU-1",
          costOfGoodsSource: "missing",
          profit: {
            operatingProfitKopecks: 74_000,
            isEstimate: true,
          },
        },
      ],
    });
  });

  it("applies an exact per-unit cost and flags a loss", () => {
    expect(analyzeParsedReport(report, { "SKU-1": 80_000 })).toMatchObject({
      totalKnownExpensesKopecks: 26_000,
      totalKnownCostOfGoodsKopecks: 80_000,
      estimatedProfitKopecks: -6_000,
      missingCostSkuCount: 0,
      lossSkuCount: 1,
      rows: [
        {
          sku: "SKU-1",
          unitCostKopecks: 80_000,
          costOfGoodsKopecks: 80_000,
          costOfGoodsSource: "user-unit-cost",
          profit: {
            costOfGoodsKopecks: 80_000,
            operatingProfitKopecks: -6_000,
            isLoss: true,
            isEstimate: true,
          },
        },
      ],
    });
  });

  it("recognizes a zero unit cost as entered instead of missing", () => {
    const analysis = analyzeParsedReport(report, { "SKU-1": 0 });

    expect(analysis.rows[0].costOfGoodsSource).toBe("user-unit-cost");
    expect(analysis.rows[0].profit.costOfGoodsKopecks).toBe(0);
    expect(analysis.missingCostSkuCount).toBe(0);
  });

  it("multiplies cost by quantity without floating-point arithmetic", () => {
    const analysis = analyzeParsedReport(
      {
        ...report,
        rows: [{ ...report.rows[0], quantity: 3 }],
      },
      { "SKU-1": 12_345 },
    );

    expect(analysis.totalKnownCostOfGoodsKopecks).toBe(37_035);
    expect(analysis.estimatedProfitKopecks).toBe(36_965);
  });

  it("rejects invalid or inapplicable unit costs", () => {
    expect(() => analyzeParsedReport(report, { "SKU-1": -1 })).toThrow(
      "must be a non-negative safe integer",
    );
    expect(() =>
      analyzeParsedReport(
        {
          ...report,
          rows: [{ ...report.rows[0], quantity: 0 }],
        },
        { "SKU-1": 100 },
      ),
    ).toThrow("requires a positive integer quantity");
  });

  it("does not silently replace required revenue with zero", () => {
    expect(() =>
      analyzeParsedReport({
        ...report,
        rows: [{ ...report.rows[0], revenueKopecks: null }],
      }),
    ).toThrow("revenueKopecks is required");
  });
});
