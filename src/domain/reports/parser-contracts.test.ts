import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyzeParsedReport } from "./analyze-report";
import type { ParsedReport } from "./parser";
import {
  parseOzonFinanceCsvText,
  OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
} from "./ozon-finance-csv-preview";
import {
  parseWildberriesApiPreviewWorkbook,
  WB_API_PREVIEW_FORMAT_VERSION,
} from "./wildberries-api-preview";
import {
  parseWildberriesFinanceCsvText,
  WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
} from "./wildberries-finance-csv-preview";

type ParserContract = {
  name: string;
  parse: () => ParsedReport | Promise<ParsedReport>;
  expected: {
    marketplace: ParsedReport["marketplace"];
    formatVersion: string;
    sourceRowCount: number;
    skuCount: number;
    skuList: string[];
    totalRevenueKopecks: number;
    totalKnownExpensesKopecks: number;
    estimatedProfitKopecks: number;
    warningCodes: string[];
    missingColumns: string[];
  };
};

function readTextFixture(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

async function readWorkbookFixture(path: string): Promise<ArrayBuffer> {
  const buffer = await readFile(new URL(path, import.meta.url));

  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

const contracts: ParserContract[] = [
  {
    name: "WB XLSX API preview synthetic fixture",
    parse: async () =>
      parseWildberriesApiPreviewWorkbook(
        await readWorkbookFixture(
          "../../../tests/fixtures/reports/wb-financial-report-api-synthetic.xlsx",
        ),
      ),
    expected: {
      marketplace: "wildberries",
      formatVersion: WB_API_PREVIEW_FORMAT_VERSION,
      sourceRowCount: 4,
      skuCount: 3,
      skuList: ["SYNTH-000001", "SYNTH-000002", "SYNTH-000003"],
      totalRevenueKopecks: 684_000,
      totalKnownExpensesKopecks: 306_250,
      estimatedProfitKopecks: 377_750,
      warningCodes: [],
      missingColumns: ["advertisingKopecks", "costOfGoodsKopecks"],
    },
  },
  {
    name: "WB CSV API-like public-shape preview fixture",
    parse: () =>
      parseWildberriesFinanceCsvText(
        readTextFixture(
          "../../../tests/fixtures/reports/wb-finance-api-public-like.csv",
        ),
      ),
    expected: {
      marketplace: "wildberries",
      formatVersion: WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
      sourceRowCount: 3,
      skuCount: 2,
      skuList: ["SYNTH-000001", "SYNTH-000002"],
      totalRevenueKopecks: 292_500,
      totalKnownExpensesKopecks: 183_400,
      estimatedProfitKopecks: 109_100,
      warningCodes: ["SERVICE_ROWS_WITHOUT_SKU_SKIPPED"],
      missingColumns: [
        "advertisingKopecks",
        "costOfGoodsKopecks",
        "forPayReconciliation",
      ],
    },
  },
  {
    name: "WB large CSV preview demo",
    parse: () =>
      parseWildberriesFinanceCsvText(
        readTextFixture("../../../public/demo/wb-finance-large-preview.csv"),
      ),
    expected: {
      marketplace: "wildberries",
      formatVersion: WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
      sourceRowCount: 36,
      skuCount: 36,
      skuList: ["SYNTH-LARGE-001", "SYNTH-LARGE-036"],
      totalRevenueKopecks: 3_600_000,
      totalKnownExpensesKopecks: 1_332_000,
      estimatedProfitKopecks: 2_268_000,
      warningCodes: [],
      missingColumns: [
        "advertisingKopecks",
        "costOfGoodsKopecks",
        "forPayReconciliation",
      ],
    },
  },
  {
    name: "Ozon CSV preview demo",
    parse: () =>
      parseOzonFinanceCsvText(
        readTextFixture("../../../public/demo/ozon-finance-preview.csv"),
      ),
    expected: {
      marketplace: "ozon",
      formatVersion: OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
      sourceRowCount: 4,
      skuCount: 3,
      skuList: ["100000001", "100000002", "100000003"],
      totalRevenueKopecks: 824_000,
      totalKnownExpensesKopecks: 406_600,
      estimatedProfitKopecks: 417_400,
      warningCodes: [],
      missingColumns: [
        "storageKopecks",
        "penaltiesKopecks",
        "advertisingKopecks",
        "costOfGoodsKopecks",
        "forPayReconciliation",
      ],
    },
  },
];

describe("preview parser contracts", () => {
  it.each(contracts)(
    "$name keeps the supported report contract stable",
    async ({ parse, expected }) => {
      const report = await parse();
      const analysis = analyzeParsedReport(report);
      const actualSkuList = report.rows.map((row) => row.sku);

      expect(report.marketplace).toBe(expected.marketplace);
      expect(report.formatVersion).toBe(expected.formatVersion);
      expect(report.sourceRowCount).toBe(expected.sourceRowCount);
      expect(analysis.skuCount).toBe(expected.skuCount);

      for (const sku of expected.skuList) {
        expect(actualSkuList).toContain(sku);
      }

      expect(analysis.totalRevenueKopecks).toBe(expected.totalRevenueKopecks);
      expect(analysis.totalKnownExpensesKopecks).toBe(
        expected.totalKnownExpensesKopecks,
      );
      expect(analysis.estimatedProfitKopecks).toBe(
        expected.estimatedProfitKopecks,
      );
      expect(report.warnings.map((warning) => warning.code)).toEqual(
        expected.warningCodes,
      );
      expect(report.missingColumns).toEqual(expected.missingColumns);
    },
  );
});
