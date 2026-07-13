export const OPTIONAL_EXPENSE_FIELDS = [
  "marketplaceCommissionKopecks",
  "logisticsKopecks",
  "storageKopecks",
  "returnsKopecks",
  "penaltiesKopecks",
  "advertisingKopecks",
  "costOfGoodsKopecks",
  "otherExpensesKopecks",
] as const;

export type OptionalExpenseField = (typeof OPTIONAL_EXPENSE_FIELDS)[number];

export type ProfitInput = {
  revenueKopecks: number;
} & Record<OptionalExpenseField, number | null>;

export type ProfitResult = {
  revenueKopecks: number;
  marketplaceExpensesKopecks: number;
  costOfGoodsKopecks: number | null;
  grossProfitKopecks: number | null;
  operatingProfitKopecks: number;
  marginBasisPoints: number | null;
  roiBasisPoints: number | null;
  isEstimate: boolean;
  isLoss: boolean;
  missingFields: OptionalExpenseField[];
};

const BASIS_POINTS = 10_000n;
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);

function assertKopecks(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${field} must be a safe integer number of kopecks`);
  }
}

function toSafeNumber(value: bigint, field: string): number {
  if (value > MAX_SAFE_INTEGER || value < MIN_SAFE_INTEGER) {
    throw new RangeError(`${field} is outside the safe integer range`);
  }

  return Number(value);
}

function divideToBasisPoints(
  numerator: bigint,
  denominator: bigint,
): number | null {
  if (denominator === 0n) {
    return null;
  }

  const scaled = numerator * BASIS_POINTS;
  const sign = scaled < 0n !== denominator < 0n ? -1n : 1n;
  const absoluteScaled = scaled < 0n ? -scaled : scaled;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const rounded =
    (absoluteScaled + absoluteDenominator / 2n) / absoluteDenominator;

  return toSafeNumber(sign * rounded, "ratio");
}

export function calculateProfit(input: ProfitInput): ProfitResult {
  assertKopecks(input.revenueKopecks, "revenueKopecks");
  if (input.revenueKopecks < 0) {
    throw new RangeError(
      "revenueKopecks must be non-negative after normalization",
    );
  }

  const missingFields: OptionalExpenseField[] = [];
  const values = new Map<OptionalExpenseField, bigint>();

  for (const field of OPTIONAL_EXPENSE_FIELDS) {
    const value = input[field];

    if (value === null) {
      missingFields.push(field);
      values.set(field, 0n);
      continue;
    }

    assertKopecks(value, field);
    if (value < 0) {
      throw new RangeError(`${field} must be non-negative after normalization`);
    }
    values.set(field, BigInt(value));
  }

  const revenue = BigInt(input.revenueKopecks);
  const costOfGoods = input.costOfGoodsKopecks;
  const marketplaceExpenses = OPTIONAL_EXPENSE_FIELDS.filter(
    (field) => field !== "costOfGoodsKopecks",
  ).reduce((sum, field) => sum + (values.get(field) ?? 0n), 0n);
  const operatingProfit =
    revenue - marketplaceExpenses - (values.get("costOfGoodsKopecks") ?? 0n);
  const grossProfit =
    costOfGoods === null ? null : revenue - BigInt(costOfGoods);

  return {
    revenueKopecks: input.revenueKopecks,
    marketplaceExpensesKopecks: toSafeNumber(
      marketplaceExpenses,
      "marketplaceExpensesKopecks",
    ),
    costOfGoodsKopecks: costOfGoods,
    grossProfitKopecks:
      grossProfit === null
        ? null
        : toSafeNumber(grossProfit, "grossProfitKopecks"),
    operatingProfitKopecks: toSafeNumber(
      operatingProfit,
      "operatingProfitKopecks",
    ),
    marginBasisPoints: divideToBasisPoints(operatingProfit, revenue),
    roiBasisPoints:
      costOfGoods !== null && costOfGoods > 0
        ? divideToBasisPoints(operatingProfit, BigInt(costOfGoods))
        : null,
    isEstimate: missingFields.length > 0,
    isLoss: operatingProfit < 0n,
    missingFields,
  };
}
