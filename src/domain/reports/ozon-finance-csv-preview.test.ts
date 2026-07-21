import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
  parseOzonFinanceCsvRows,
  parseOzonFinanceCsvText,
} from "./ozon-finance-csv-preview";
import { ReportParseError } from "./wildberries-api-preview";

const HEADERS = [
  "SKU",
  "offer_id",
  "Название товара",
  "Тип начисления",
  "Дата операции",
  "Количество",
  "Сумма итого, руб.",
  "Комиссия за продажу",
  "Логистика",
  "Обработка отправления",
  "Возвраты",
  "Прочие услуги",
];

function makeRow(overrides: Record<string, string> = {}) {
  const source: Record<string, string> = {
    SKU: "100000001",
    offer_id: "OZON-DEMO-001",
    "Название товара": "Тестовый товар",
    "Тип начисления": "Доставка покупателю",
    "Дата операции": "2026-07-03",
    Количество: "1",
    "Сумма итого, руб.": "1000,00",
    "Комиссия за продажу": "150,00",
    Логистика: "50,00",
    "Обработка отправления": "20,00",
    Возвраты: "0,00",
    "Прочие услуги": "0,00",
    ...overrides,
  };

  return HEADERS.map((header) => source[header]);
}

describe("Ozon finance CSV preview parser", () => {
  it("parses the bundled synthetic Ozon CSV demo", () => {
    const csv = readFileSync(
      new URL("../../../public/demo/ozon-finance-preview.csv", import.meta.url),
      "utf8",
    );

    const report = parseOzonFinanceCsvText(csv);

    expect(report.marketplace).toBe("ozon");
    expect(report.formatVersion).toBe(OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION);
    expect(report.sourceRowCount).toBe(4);
    expect(report.missingColumns).toEqual([
      "storageKopecks",
      "penaltiesKopecks",
      "advertisingKopecks",
      "costOfGoodsKopecks",
      "forPayReconciliation",
    ]);
    expect(report.rows).toEqual([
      {
        sourceRowNumber: 2,
        sku: "100000001",
        offerId: "OZON-DEMO-001",
        productName: "Органайзер для дома",
        quantity: 1,
        revenueKopecks: 398_000,
        marketplaceCommissionKopecks: 59_700,
        logisticsKopecks: 33_000,
        storageKopecks: null,
        returnsKopecks: 199_000,
        penaltiesKopecks: null,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 9_000,
      },
      {
        sourceRowNumber: 4,
        sku: "100000002",
        offerId: "OZON-DEMO-002",
        productName: "Бутылка для воды",
        quantity: 3,
        revenueKopecks: 267_000,
        marketplaceCommissionKopecks: 40_050,
        logisticsKopecks: 18_000,
        storageKopecks: null,
        returnsKopecks: 0,
        penaltiesKopecks: null,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 11_500,
      },
      {
        sourceRowNumber: 5,
        sku: "100000003",
        offerId: "OZON-DEMO-003",
        productName: "Набор контейнеров",
        quantity: 1,
        revenueKopecks: 159_000,
        marketplaceCommissionKopecks: 23_850,
        logisticsKopecks: 9_500,
        storageKopecks: null,
        returnsKopecks: 0,
        penaltiesKopecks: null,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 3_000,
      },
    ]);
  });

  it("rejects unsupported Ozon service operation with SKU instead of guessing allocation", () => {
    expect(() =>
      parseOzonFinanceCsvRows([
        HEADERS,
        makeRow({
          "Тип начисления": "Услуга продвижения",
          Количество: "0",
          "Сумма итого, руб.": "500,00",
        }),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "UNSUPPORTED_OZON_OPERATION",
      }),
    );
  });

  it("rejects missing required Ozon columns without exposing source rows", () => {
    expect(() =>
      parseOzonFinanceCsvRows([
        HEADERS.filter((header) => header !== "Тип начисления"),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "OZON_FINANCE_CSV_FORMAT_NOT_RECOGNIZED",
      }),
    );
  });
});
