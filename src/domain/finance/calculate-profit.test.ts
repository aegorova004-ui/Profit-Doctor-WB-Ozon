import { describe, expect, it } from "vitest";

import { calculateProfit, type ProfitInput } from "./calculate-profit";

const completeInput: ProfitInput = {
  revenueKopecks: 100_000,
  marketplaceCommissionKopecks: 15_000,
  logisticsKopecks: 8_000,
  storageKopecks: 1_000,
  returnsKopecks: 2_000,
  penaltiesKopecks: 0,
  advertisingKopecks: 5_000,
  costOfGoodsKopecks: 40_000,
  otherExpensesKopecks: 1_000,
};

describe("calculateProfit", () => {
  it("calculates exact money totals and basis-point ratios", () => {
    expect(calculateProfit(completeInput)).toEqual({
      revenueKopecks: 100_000,
      marketplaceExpensesKopecks: 32_000,
      costOfGoodsKopecks: 40_000,
      grossProfitKopecks: 60_000,
      operatingProfitKopecks: 28_000,
      marginBasisPoints: 2_800,
      roiBasisPoints: 7_000,
      isEstimate: false,
      isLoss: false,
      missingFields: [],
    });
  });

  it("marks a negative operating result as a loss", () => {
    const result = calculateProfit({
      ...completeInput,
      revenueKopecks: 10_000,
      marketplaceCommissionKopecks: 2_000,
      logisticsKopecks: 4_000,
      storageKopecks: 0,
      returnsKopecks: 0,
      penaltiesKopecks: 1_000,
      advertisingKopecks: 0,
      costOfGoodsKopecks: 5_000,
      otherExpensesKopecks: 0,
    });

    expect(result.operatingProfitKopecks).toBe(-2_000);
    expect(result.marginBasisPoints).toBe(-2_000);
    expect(result.roiBasisPoints).toBe(-4_000);
    expect(result.isLoss).toBe(true);
  });

  it("labels a calculation with missing costs as an estimate", () => {
    const result = calculateProfit({
      ...completeInput,
      advertisingKopecks: null,
      costOfGoodsKopecks: null,
    });

    expect(result.operatingProfitKopecks).toBe(73_000);
    expect(result.grossProfitKopecks).toBeNull();
    expect(result.roiBasisPoints).toBeNull();
    expect(result.isEstimate).toBe(true);
    expect(result.missingFields).toEqual([
      "advertisingKopecks",
      "costOfGoodsKopecks",
    ]);
  });

  it("does not report margin when revenue is zero", () => {
    const result = calculateProfit({
      ...completeInput,
      revenueKopecks: 0,
    });

    expect(result.marginBasisPoints).toBeNull();
  });

  it("does not report ROI when cost of goods is zero", () => {
    const result = calculateProfit({
      ...completeInput,
      costOfGoodsKopecks: 0,
    });

    expect(result.roiBasisPoints).toBeNull();
  });

  it("does not mark a zero operating result as a loss", () => {
    const result = calculateProfit({
      revenueKopecks: 10_000,
      marketplaceCommissionKopecks: 0,
      logisticsKopecks: 0,
      storageKopecks: 0,
      returnsKopecks: 0,
      penaltiesKopecks: 0,
      advertisingKopecks: 0,
      costOfGoodsKopecks: 10_000,
      otherExpensesKopecks: 0,
    });

    expect(result.operatingProfitKopecks).toBe(0);
    expect(result.isLoss).toBe(false);
  });

  it("rejects an aggregate outside the safe integer range", () => {
    expect(() =>
      calculateProfit({
        ...completeInput,
        marketplaceCommissionKopecks: Number.MAX_SAFE_INTEGER,
        logisticsKopecks: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow(/outside the safe integer range/);
  });

  it("rejects fractional kopecks", () => {
    expect(() =>
      calculateProfit({
        ...completeInput,
        logisticsKopecks: 10.5,
      }),
    ).toThrow(/safe integer number of kopecks/);
  });

  it("rejects an expense with a negative normalized sign", () => {
    expect(() =>
      calculateProfit({
        ...completeInput,
        returnsKopecks: -100,
      }),
    ).toThrow(/must be non-negative after normalization/);
  });

  it("rejects negative revenue after normalization", () => {
    expect(() =>
      calculateProfit({
        ...completeInput,
        revenueKopecks: -100,
      }),
    ).toThrow(/revenueKopecks must be non-negative after normalization/);
  });
});
