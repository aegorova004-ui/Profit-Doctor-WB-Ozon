import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  parseWildberriesApiPreviewWorkbook,
  parseWildberriesApiRows,
  ReportParseError,
  WB_API_PREVIEW_FORMAT_VERSION,
} from "./wildberries-api-preview";

const HEADERS = [
  "currency_name",
  "subject_name",
  "nm_id",
  "barcode",
  "doc_type_name",
  "quantity",
  "retail_amount",
  "ppvz_for_pay",
  "delivery_rub",
  "penalty",
  "additional_payment",
  "storage_fee",
  "deduction",
  "for_pay",
];

function makeRow(overrides: Record<string, string> = {}) {
  const source: Record<string, string> = {
    currency_name: "RUB",
    subject_name: "Тестовый товар",
    nm_id: "700000001",
    barcode: "SYNTH-1",
    doc_type_name: "Продажа",
    quantity: "1",
    retail_amount: "1000",
    ppvz_for_pay: "750",
    delivery_rub: "40",
    penalty: "0",
    additional_payment: "0",
    storage_fee: "10",
    deduction: "0",
    for_pay: "700",
    ...overrides,
  };

  return HEADERS.map((header) => source[header]);
}

describe("Wildberries API preview parser", () => {
  it("reads the synthetic XLSX fixture and reconciles every SKU", async () => {
    const buffer = await readFile(
      new URL(
        "../../../tests/fixtures/reports/wb-financial-report-api-synthetic.xlsx",
        import.meta.url,
      ),
    );
    const input = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    const report = await parseWildberriesApiPreviewWorkbook(input);

    expect(report.marketplace).toBe("wildberries");
    expect(report.formatVersion).toBe(WB_API_PREVIEW_FORMAT_VERSION);
    expect(report.sourceRowCount).toBe(4);
    expect(report.missingColumns).toEqual([
      "advertisingKopecks",
      "costOfGoodsKopecks",
    ]);
    expect(report.rows).toEqual([
      {
        sourceRowNumber: 5,
        sku: "SYNTH-000001",
        offerId: "700000001",
        productName: "Органайзер для дома",
        quantity: 1,
        revenueKopecks: 258_000,
        marketplaceCommissionKopecks: 32_250,
        logisticsKopecks: 14_700,
        storageKopecks: 1_800,
        returnsKopecks: 129_000,
        penaltiesKopecks: 0,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 0,
      },
      {
        sourceRowNumber: 7,
        sku: "SYNTH-000002",
        offerId: "700000002",
        productName: "Бутылка для воды",
        quantity: 3,
        revenueKopecks: 267_000,
        marketplaceCommissionKopecks: 66_750,
        logisticsKopecks: 14_700,
        storageKopecks: 900,
        returnsKopecks: 0,
        penaltiesKopecks: 0,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 0,
      },
      {
        sourceRowNumber: 8,
        sku: "SYNTH-000003",
        offerId: "700000003",
        productName: "Набор контейнеров",
        quantity: 1,
        revenueKopecks: 159_000,
        marketplaceCommissionKopecks: 39_750,
        logisticsKopecks: 4_900,
        storageKopecks: 1_500,
        returnsKopecks: 0,
        penaltiesKopecks: 0,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 0,
      },
    ]);
  });

  it("handles a preamble and aggregates a return into its SKU", () => {
    const report = parseWildberriesApiRows([
      ["Служебная строка"],
      HEADERS,
      makeRow(),
      makeRow({
        doc_type_name: "Возврат",
        quantity: "-1",
        retail_amount: "-1000",
        ppvz_for_pay: "-750",
        delivery_rub: "40",
        storage_fee: "10",
        for_pay: "-800",
      }),
    ]);

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      quantity: 0,
      revenueKopecks: 100_000,
      returnsKopecks: 100_000,
      marketplaceCommissionKopecks: 0,
      logisticsKopecks: 8_000,
      storageKopecks: 2_000,
    });
  });

  it("rejects missing columns without exposing source rows", () => {
    expect(() =>
      parseWildberriesApiRows([
        HEADERS.filter((header) => header !== "for_pay"),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "MISSING_COLUMNS",
        message: expect.stringContaining("for_pay"),
      }),
    );
  });

  it("explains when a Wildberries product catalog is uploaded instead of a finance report", () => {
    expect(() =>
      parseWildberriesApiRows([
        [
          "Категория",
          "Название",
          "Артикул",
          "URL",
          "Цена",
          "Цена со скидкой",
          "Производитель",
        ],
        [
          "Красота",
          "Аппликаторы",
          "7399476",
          "https://www.wildberries.ru/catalog/7399476/detail.aspx",
          "360",
          "306",
          "Queen fair",
        ],
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "WB_PRODUCT_CATALOG_UPLOADED",
      }),
    );
  });

  it("rejects the bundled synthetic WB product catalog demo", async () => {
    const buffer = await readFile(
      new URL(
        "../../../public/demo/wb-product-catalog-not-finance.xlsx",
        import.meta.url,
      ),
    );
    const input = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    await expect(
      parseWildberriesApiPreviewWorkbook(input),
    ).rejects.toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "WB_PRODUCT_CATALOG_UPLOADED",
      }),
    );
  });

  it("rejects an unsupported currency with a public row number", () => {
    expect(() =>
      parseWildberriesApiRows([HEADERS, makeRow({ currency_name: "USD" })]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "UNSUPPORTED_CURRENCY",
        sourceRowNumber: 2,
      }),
    );
  });

  it("fails when the payout cannot be reconciled", () => {
    expect(() =>
      parseWildberriesApiRows([HEADERS, makeRow({ for_pay: "699.98" })]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "PAYOUT_RECONCILIATION_FAILED",
      }),
    );
  });
});
