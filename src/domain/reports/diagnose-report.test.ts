import { describe, expect, it } from "vitest";
import { analyzeParsedReport } from "./analyze-report";
import { diagnoseReport } from "./diagnose-report";
import type { NormalizedReportRow, ParsedReport } from "./parser";

function row(
  sku: string,
  overrides: Partial<NormalizedReportRow> = {},
): NormalizedReportRow {
  return {
    sourceRowNumber: 2,
    sku,
    offerId: null,
    productName: sku,
    quantity: 1,
    revenueKopecks: 100_000,
    marketplaceCommissionKopecks: 20_000,
    logisticsKopecks: 0,
    storageKopecks: 0,
    returnsKopecks: 0,
    penaltiesKopecks: 0,
    advertisingKopecks: null,
    costOfGoodsKopecks: null,
    otherExpensesKopecks: 0,
    ...overrides,
  };
}

function report(rows: NormalizedReportRow[]): ParsedReport {
  return {
    marketplace: "wildberries",
    formatVersion: "test",
    sourceRowCount: rows.length,
    warnings: [],
    missingColumns: ["advertisingKopecks", "costOfGoodsKopecks"],
    rows,
  };
}

describe("diagnoseReport", () => {
  it("calculates the exact break-even gap and prioritizes the largest loss", () => {
    const analysis = analyzeParsedReport(
      report([
        row("LOSS-1", { quantity: 2 }),
        row("LOSS-2", {
          marketplaceCommissionKopecks: 25_000,
        }),
        row("POSITIVE"),
      ]),
      {
        "LOSS-1": 45_000,
        "LOSS-2": 90_000,
        POSITIVE: 50_000,
      },
    );

    expect(diagnoseReport(analysis)).toMatchObject({
      totalLossKopecks: 25_000,
      totalPositiveBufferKopecks: 30_000,
      lossSkuCount: 2,
      primaryLossSku: "LOSS-2",
      prioritySkus: ["LOSS-2", "LOSS-1"],
      rows: [
        {
          sku: "LOSS-1",
          status: "loss",
          breakEvenGapKopecks: 10_000,
          positiveBufferKopecks: 0,
          maxAffordableCostOfGoodsKopecks: 80_000,
          maxAffordableUnitCostKopecks: 40_000,
          lossBeforeCostOfGoods: false,
          largestKnownExpense: {
            driver: "cost-of-goods",
            amountKopecks: 90_000,
          },
        },
        {
          sku: "LOSS-2",
          breakEvenGapKopecks: 15_000,
          maxAffordableCostOfGoodsKopecks: 75_000,
          maxAffordableUnitCostKopecks: 75_000,
        },
        {
          sku: "POSITIVE",
          status: "positive-estimate",
          breakEvenGapKopecks: 0,
          positiveBufferKopecks: 30_000,
        },
      ],
    });
  });

  it("reports when marketplace expenses cause a loss before cost of goods", () => {
    const analysis = analyzeParsedReport(
      report([
        row("EXPENSIVE-WB", {
          revenueKopecks: 50_000,
          marketplaceCommissionKopecks: 60_000,
        }),
      ]),
      { "EXPENSIVE-WB": 10_000 },
    );
    const diagnosis = diagnoseReport(analysis);

    expect(diagnosis.rows[0]).toMatchObject({
      status: "loss",
      breakEvenGapKopecks: 20_000,
      maxAffordableCostOfGoodsKopecks: 0,
      maxAffordableUnitCostKopecks: 0,
      lossBeforeCostOfGoods: true,
      largestKnownExpense: {
        driver: "commission",
        amountKopecks: 60_000,
      },
    });
  });

  it("does not prescribe a profitability action while cost is missing", () => {
    const diagnosis = diagnoseReport(
      analyzeParsedReport(report([row("NO-COST")])),
    );

    expect(diagnosis.rows[0]).toMatchObject({
      status: "missing-cost",
      breakEvenGapKopecks: 0,
      positiveBufferKopecks: 80_000,
    });
    expect(diagnosis.lossSkuCount).toBe(0);
    expect(diagnosis.totalPositiveBufferKopecks).toBe(0);
  });

  it("keeps a known loss visible even while cost of goods is missing", () => {
    const diagnosis = diagnoseReport(
      analyzeParsedReport(
        report([
          row("KNOWN-LOSS", {
            revenueKopecks: 50_000,
            marketplaceCommissionKopecks: 60_000,
          }),
        ]),
      ),
    );

    expect(diagnosis.rows[0]).toMatchObject({
      status: "loss",
      breakEvenGapKopecks: 10_000,
      lossBeforeCostOfGoods: true,
    });
    expect(diagnosis.totalLossKopecks).toBe(10_000);
  });

  it("distinguishes a complete positive result from an estimate", () => {
    const diagnosis = diagnoseReport(
      analyzeParsedReport(report([row("FULL", { advertisingKopecks: 0 })]), {
        FULL: 50_000,
      }),
    );

    expect(diagnosis.rows[0].status).toBe("positive");
  });
});
