import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { analyzeParsedReport } from "./analyze-report";
import {
  buildReportCsv,
  buildReportWorkbookSheets,
  createReportExportFileName,
  REPORT_EXPORT_VERSION,
  REPORT_FORMULA_VERSION,
} from "./export-report";
import type { ParsedReport } from "./parser";
import { parseWildberriesApiPreviewWorkbook } from "./wildberries-api-preview";

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/reports/wb-financial-report-api-synthetic.xlsx",
);

async function createFixtureAnalysis() {
  const buffer = await readFile(FIXTURE_PATH);
  const report = await parseWildberriesApiPreviewWorkbook(
    new Uint8Array(buffer).buffer,
  );

  return analyzeParsedReport(report, {
    "SYNTH-000001": 90_000,
    "SYNTH-000002": 50_000,
    "SYNTH-000003": 130_000,
  });
}

describe("report export", () => {
  it("builds an exact semicolon CSV with metadata and diagnosis", async () => {
    const csv = buildReportCsv({
      analysis: await createFixtureAnalysis(),
      sourceFileName: "synthetic-wb.xlsx",
      createdAtIso: "2026-07-13T20:00:00.000Z",
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(`"Версия экспорта";"${REPORT_EXPORT_VERSION}"`);
    expect(csv).toContain(`"Версия формулы";"${REPORT_FORMULA_VERSION}"`);
    expect(csv).toContain('"1";"Убыток";"Набор контейнеров"');
    expect(csv).toContain('"-171,50";"171,50";"1128,50"');
    expect(csv).toContain("Улучшите результат минимум на 171,50 ₽");
  });

  it("writes a two-sheet XLSX whose money cells derive from integer kopecks", async () => {
    const sheets = buildReportWorkbookSheets<Buffer>({
      analysis: await createFixtureAnalysis(),
      sourceFileName: "synthetic-wb.xlsx",
      createdAtIso: "2026-07-13T20:00:00.000Z",
    });
    const skuSheet = sheets.find((sheet) => sheet.sheet === "SKU");
    const containerRow = skuSheet?.data.find(
      (row) =>
        typeof row[3] === "object" &&
        row[3] !== null &&
        "value" in row[3] &&
        row[3].value === "SYNTH-000003",
    );
    const organizerRow = skuSheet?.data.find(
      (row) =>
        typeof row[3] === "object" &&
        row[3] !== null &&
        "value" in row[3] &&
        row[3].value === "SYNTH-000001",
    );

    expect(sheets.map((sheet) => sheet.sheet)).toEqual(["Сводка", "SKU"]);
    expect(organizerRow?.[17]).toMatchObject({
      value: "=-9750/100",
      type: "Formula",
    });
    expect(containerRow?.[19]).toMatchObject({
      value: "=112850/100",
      type: "Formula",
    });

    const workbook = await writeXlsxFile(sheets).toBuffer();
    expect(workbook.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(workbook.byteLength).toBeGreaterThan(5_000);
  });

  it("neutralizes spreadsheet formulas in user-controlled CSV text", () => {
    const report: ParsedReport = {
      marketplace: "wildberries",
      formatVersion: "test",
      sourceRowCount: 1,
      warnings: [],
      missingColumns: [],
      rows: [
        {
          sourceRowNumber: 2,
          sku: "+SUM(A1:A2)",
          offerId: "@offer",
          productName: '=HYPERLINK("https://example.com")',
          quantity: 1,
          revenueKopecks: 10_000,
          marketplaceCommissionKopecks: 1_000,
          logisticsKopecks: 0,
          storageKopecks: 0,
          returnsKopecks: 0,
          penaltiesKopecks: 0,
          advertisingKopecks: 0,
          costOfGoodsKopecks: 5_000,
          otherExpensesKopecks: 0,
        },
      ],
    };

    const csv = buildReportCsv({
      analysis: analyzeParsedReport(report),
      sourceFileName: "=unsafe.xlsx",
      createdAtIso: "2026-07-13T20:00:00.000Z",
    });

    expect(csv).toContain("'=unsafe.xlsx");
    expect(csv).toContain('\'=HYPERLINK(""https://example.com"")');
    expect(csv).toContain("'+SUM(A1:A2)");
    expect(csv).toContain("'@offer");
  });

  it("keeps user-controlled XLSX text as string cells, not formulas", () => {
    const report: ParsedReport = {
      marketplace: "wildberries",
      formatVersion: "test",
      sourceRowCount: 1,
      warnings: [],
      missingColumns: [],
      rows: [
        {
          sourceRowNumber: 2,
          sku: "+SUM(A1:A2)",
          offerId: "@offer",
          productName: '=HYPERLINK("https://example.com")',
          quantity: 1,
          revenueKopecks: 10_000,
          marketplaceCommissionKopecks: 1_000,
          logisticsKopecks: 0,
          storageKopecks: 0,
          returnsKopecks: 0,
          penaltiesKopecks: 0,
          advertisingKopecks: 0,
          costOfGoodsKopecks: 5_000,
          otherExpensesKopecks: 0,
        },
      ],
    };

    const sheets = buildReportWorkbookSheets({
      analysis: analyzeParsedReport(report),
      sourceFileName: "=unsafe.xlsx",
      createdAtIso: "2026-07-13T20:00:00.000Z",
    });
    const skuSheet = sheets.find((sheet) => sheet.sheet === "SKU");
    const row = skuSheet?.data[1];

    expect(row?.[2]).toMatchObject({
      value: '=HYPERLINK("https://example.com")',
      type: String,
    });
    expect(row?.[3]).toMatchObject({
      value: "+SUM(A1:A2)",
      type: String,
    });
    expect(row?.[4]).toMatchObject({
      value: "@offer",
      type: String,
    });
  });

  it("keeps user-controlled XLSX source filename as a string cell", async () => {
    const sheets = buildReportWorkbookSheets({
      analysis: await createFixtureAnalysis(),
      sourceFileName: "=unsafe-source.xlsx",
      createdAtIso: "2026-07-13T20:00:00.000Z",
    });
    const summarySheet = sheets.find((sheet) => sheet.sheet === "Сводка");
    const sourceFileRow = summarySheet?.data.find(
      (row) =>
        typeof row[0] === "object" &&
        row[0] !== null &&
        "value" in row[0] &&
        row[0].value === "Исходный файл",
    );

    expect(sourceFileRow?.[1]).toMatchObject({
      value: "=unsafe-source.xlsx",
      type: String,
    });
  });

  it("creates a stable, filesystem-safe export name", () => {
    expect(createReportExportFileName("Отчёт WB / июль.xlsx", "xlsx")).toBe(
      "profit-doctor-Отчёт-WB-июль.xlsx",
    );
    expect(createReportExportFileName("...", "csv")).toBe(
      "profit-doctor-report.csv",
    );
  });
});
