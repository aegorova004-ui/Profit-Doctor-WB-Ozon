const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);

export class ExactNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExactNumberError";
  }
}

function normalizeDecimal(value: string): string {
  const normalized = value.trim().replace(",", ".");

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new ExactNumberError("value is not a plain decimal number");
  }

  return normalized;
}

export function bigintToSafeNumber(value: bigint, field: string): number {
  if (value > MAX_SAFE_INTEGER || value < MIN_SAFE_INTEGER) {
    throw new ExactNumberError(`${field} is outside the safe integer range`);
  }

  return Number(value);
}

export function parseInteger(value: string, field: string): number {
  const normalized = value.trim();

  if (!/^[+-]?\d+$/.test(normalized)) {
    throw new ExactNumberError(`${field} must be an integer`);
  }

  return bigintToSafeNumber(BigInt(normalized), field);
}

export function parseRublesToKopecks(value: string, field: string): number {
  const normalized = normalizeDecimal(value);
  const negative = normalized.startsWith("-");
  const unsigned = normalized.replace(/^[+-]/, "");
  const [rubles, fraction = ""] = unsigned.split(".");

  if (fraction.length > 2 && /[^0]/.test(fraction.slice(2))) {
    throw new ExactNumberError(`${field} has fractions smaller than a kopeck`);
  }

  const kopecks = BigInt(rubles) * 100n + BigInt((fraction + "00").slice(0, 2));

  return bigintToSafeNumber(negative ? -kopecks : kopecks, field);
}
