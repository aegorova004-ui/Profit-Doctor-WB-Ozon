import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { detectReportMarketplace } from "./detect-marketplace";

describe("detectReportMarketplace", () => {
  it.each([
    ["wb-synthetic.csv", "wildberries"],
    ["ozon-synthetic.csv", "ozon"],
  ] as const)("recognizes the %s fixture", (fileName, marketplace) => {
    const csv = readFileSync(
      new URL(`../../../tests/fixtures/reports/${fileName}`, import.meta.url),
      "utf8",
    );
    const [headerLine] = csv.split(/\r?\n/, 1);

    expect(detectReportMarketplace(headerLine.split(";"))).toBe(marketplace);
  });

  it("recognizes representative Wildberries headers", () => {
    expect(
      detectReportMarketplace([
        "Код номенклатуры",
        "Артикул поставщика",
        "Обоснование для оплаты",
        "Вайлдберриз реализовал Товар (Пр)",
      ]),
    ).toBe("wildberries");
  });

  it("recognizes the WB API financial report headers", () => {
    expect(
      detectReportMarketplace(["nm_id", "doc_type_name", "ppvz_for_pay"]),
    ).toBe("wildberries");
  });

  it("recognizes the WB finance CSV API-like headers", () => {
    expect(
      detectReportMarketplace([
        "realizationreport_id",
        "nm_id",
        "barcode",
        "supplier_oper_name",
        "ppvz_for_pay",
      ]),
    ).toBe("wildberries");
  });

  it("recognizes representative Ozon headers", () => {
    expect(
      detectReportMarketplace([
        "SKU",
        "offer_id",
        "Тип начисления",
        "Сумма итого, руб.",
      ]),
    ).toBe("ozon");
  });

  it("returns null for ambiguous or unknown headers", () => {
    expect(detectReportMarketplace(["Артикул", "Сумма"])).toBeNull();
    expect(
      detectReportMarketplace([
        "Код номенклатуры",
        "Артикул поставщика",
        "SKU",
        "offer_id",
      ]),
    ).toBeNull();
  });
});
