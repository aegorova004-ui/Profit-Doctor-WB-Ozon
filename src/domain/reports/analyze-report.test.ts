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
      estimatedProfitKopecks: 74_000,
      missingColumns: ["advertisingKopecks", "costOfGoodsKopecks"],
      rows: [
        {
          sku: "SKU-1",
          profit: {
            operatingProfitKopecks: 74_000,
            isEstimate: true,
          },
        },
      ],
    });
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
