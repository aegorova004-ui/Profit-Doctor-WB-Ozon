import { describe, expect, it } from "vitest";
import {
  bigintToSafeNumber,
  ExactNumberError,
  parseInteger,
  parseRublesToKopecks,
} from "./decimal";

describe("exact report numbers", () => {
  it.each([
    ["0", 0],
    ["19", 1900],
    ["19.5", 1950],
    ["19,05", 1905],
    ["-967.50", -96_750],
    ["  +1.20  ", 120],
    ["1.2300", 123],
  ])("converts %s rubles to exact kopecks", (source, expected) => {
    expect(parseRublesToKopecks(source, "amount")).toBe(expected);
  });

  it.each(["1e3", "1 000", "1.001", "12.3.4", ""])(
    "rejects ambiguous or sub-kopeck value %j",
    (source) => {
      expect(() => parseRublesToKopecks(source, "amount")).toThrow(
        ExactNumberError,
      );
    },
  );

  it("parses integer quantities without rounding", () => {
    expect(parseInteger("-12", "quantity")).toBe(-12);
    expect(() => parseInteger("1.5", "quantity")).toThrow(ExactNumberError);
  });

  it("rejects integers outside the JavaScript safe range", () => {
    expect(() =>
      bigintToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n, "amount"),
    ).toThrow(ExactNumberError);
  });
});
