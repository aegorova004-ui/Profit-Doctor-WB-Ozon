import { describe, expect, it } from "vitest";
import { parseCsvRows } from "./csv";

describe("parseCsvRows", () => {
  it("parses semicolon CSV with quoted separators and removes empty rows", () => {
    expect(
      parseCsvRows('SKU;Название;Сумма\r\n1;"Товар; тест";100,50\r\n\r\n'),
    ).toEqual([
      ["SKU", "Название", "Сумма"],
      ["1", "Товар; тест", "100,50"],
    ]);
  });

  it("parses comma CSV with escaped quotes", () => {
    expect(parseCsvRows('sku,name\n1,"Товар ""А"""')).toEqual([
      ["sku", "name"],
      ["1", 'Товар "А"'],
    ]);
  });
});
