import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseWildberriesFinanceCsvRows,
  parseWildberriesFinanceCsvText,
  WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
} from "./wildberries-finance-csv-preview";
import { ReportParseError } from "./wildberries-api-preview";

const HEADERS = [
  "currency_name",
  "subject_name",
  "nm_id",
  "barcode",
  "supplier_oper_name",
  "quantity",
  "retail_amount",
  "ppvz_for_pay",
  "delivery_rub",
  "penalty",
  "additional_payment",
  "storage_fee",
  "deduction",
  "acquiring_fee",
  "acceptance",
  "payment_processing",
  "cashback_amount",
];

function makeRow(overrides: Record<string, string> = {}) {
  const source: Record<string, string> = {
    currency_name: "RUB",
    subject_name: "Тестовый товар",
    nm_id: "700000001",
    barcode: "SYNTH-1",
    supplier_oper_name: "Продажа",
    quantity: "1",
    retail_amount: "1000",
    ppvz_for_pay: "750",
    delivery_rub: "40",
    penalty: "0",
    additional_payment: "0",
    storage_fee: "10",
    deduction: "0",
    acquiring_fee: "0",
    acceptance: "0",
    payment_processing: "0",
    cashback_amount: "0",
    ...overrides,
  };

  return HEADERS.map((header) => source[header]);
}

describe("Wildberries finance CSV preview parser", () => {
  it("parses a public-like WB finance CSV without for_pay reconciliation", () => {
    const csv = readFileSync(
      new URL(
        "../../../tests/fixtures/reports/wb-finance-api-public-like.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const report = parseWildberriesFinanceCsvText(csv);

    expect(report.marketplace).toBe("wildberries");
    expect(report.formatVersion).toBe(WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION);
    expect(report.sourceRowCount).toBe(3);
    expect(report.missingColumns).toEqual([
      "advertisingKopecks",
      "costOfGoodsKopecks",
      "forPayReconciliation",
    ]);
    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: "SERVICE_ROWS_WITHOUT_SKU_SKIPPED",
      }),
    ]);
    expect(report.rows).toEqual([
      {
        sourceRowNumber: 2,
        sku: "SYNTH-000001",
        offerId: "700000001",
        productName: "Органайзер для дома",
        quantity: 1,
        revenueKopecks: 200_000,
        marketplaceCommissionKopecks: 25_000,
        logisticsKopecks: 18_000,
        storageKopecks: 3_000,
        returnsKopecks: 100_000,
        penaltiesKopecks: 0,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 6_000,
      },
      {
        sourceRowNumber: 4,
        sku: "SYNTH-000002",
        offerId: "700000002",
        productName: "Бутылка для воды",
        quantity: 1,
        revenueKopecks: 92_500,
        marketplaceCommissionKopecks: 22_500,
        logisticsKopecks: 4_000,
        storageKopecks: 800,
        returnsKopecks: 0,
        penaltiesKopecks: 500,
        advertisingKopecks: null,
        costOfGoodsKopecks: null,
        otherExpensesKopecks: 3_600,
      },
    ]);
  });

  it("parses the bundled synthetic WB finance CSV demo", () => {
    const csv = readFileSync(
      new URL(
        "../../../public/demo/wb-finance-api-preview.csv",
        import.meta.url,
      ),
      "utf8",
    );

    const report = parseWildberriesFinanceCsvText(csv);

    expect(report.sourceRowCount).toBe(3);
    expect(report.rows).toHaveLength(2);
    expect(report.formatVersion).toBe(WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION);
  });

  it("accepts UTF-8 BOM and tab-separated WB CSV exports", () => {
    const report = parseWildberriesFinanceCsvText(
      `\uFEFF${HEADERS.join("\t")}\n${makeRow().join("\t")}`,
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      sku: "SYNTH-1",
      revenueKopecks: 100_000,
    });
  });

  it("rejects duplicate columns before reading financial rows", () => {
    expect(() =>
      parseWildberriesFinanceCsvRows([
        [...HEADERS, "barcode"],
        [...makeRow(), "SYNTH-DUPLICATE"],
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "DUPLICATE_COLUMN",
      }),
    );
  });

  it("rejects oversized CSV tables before trying to classify operations", () => {
    expect(() =>
      parseWildberriesFinanceCsvRows(
        Array.from({ length: 100_021 }, () => [""]),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "TOO_MANY_ROWS",
      }),
    );

    expect(() =>
      parseWildberriesFinanceCsvRows([Array.from({ length: 121 }, () => "")]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "TOO_MANY_COLUMNS",
      }),
    );
  });

  it("rejects a service-only public WB finance CSV instead of spreading it over SKU", () => {
    expect(() =>
      parseWildberriesFinanceCsvRows([
        HEADERS,
        makeRow({
          nm_id: "0",
          barcode: "",
          supplier_oper_name:
            "Возмещение издержек по перевозке/по складским операциям с товаром",
          quantity: "0",
          retail_amount: "0",
          ppvz_for_pay: "0",
        }),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "NO_PRODUCT_FINANCE_ROWS",
      }),
    );
  });

  it("rejects missing supplier operation without exposing source rows", () => {
    expect(() =>
      parseWildberriesFinanceCsvRows([
        HEADERS.filter((header) => header !== "supplier_oper_name"),
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<ReportParseError>>({
        code: "MISSING_COLUMNS",
        message: expect.stringContaining("supplier_oper_name"),
      }),
    );
  });
});
