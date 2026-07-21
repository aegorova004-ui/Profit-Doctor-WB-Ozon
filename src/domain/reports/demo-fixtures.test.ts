import { readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { parseCsvRows } from "./csv";
import { detectReportMarketplace } from "./detect-marketplace";
import { parseOzonFinanceCsvText } from "./ozon-finance-csv-preview";
import { parseWildberriesApiPreviewWorkbook } from "./wildberries-api-preview";
import { parseWildberriesFinanceCsvText } from "./wildberries-finance-csv-preview";

const DEMO_DIRECTORY = new URL("../../../public/demo/", import.meta.url);

const EXPECTED_DEMO_FILES = [
  "ozon-finance-preview.csv",
  "unsupported-finance-format.csv",
  "wb-finance-api-preview.csv",
  "wb-finance-large-preview.csv",
  "wb-financial-report-preview.xlsx",
  "wb-product-catalog-not-finance.xlsx",
] as const;

function readDemoText(fileName: string): string {
  return readFileSync(new URL(fileName, DEMO_DIRECTORY), "utf8");
}

async function readDemoWorkbook(fileName: string): Promise<ArrayBuffer> {
  const buffer = await readFile(new URL(fileName, DEMO_DIRECTORY));

  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

describe("public demo fixtures", () => {
  it("keeps the public demo directory intentional", () => {
    const actualFiles = readdirSync(DEMO_DIRECTORY).sort();

    expect(actualFiles).toEqual([...EXPECTED_DEMO_FILES].sort());
  });

  it.each(EXPECTED_DEMO_FILES)("%s is not empty", (fileName) => {
    const stats = statSync(new URL(fileName, DEMO_DIRECTORY));

    expect(stats.size).toBeGreaterThan(100);
  });

  it("parses the public WB XLSX demo", async () => {
    const report = await parseWildberriesApiPreviewWorkbook(
      await readDemoWorkbook("wb-financial-report-preview.xlsx"),
    );

    expect(report.marketplace).toBe("wildberries");
    expect(report.sourceRowCount).toBe(4);
    expect(report.rows).toHaveLength(3);
  });

  it("parses the public WB finance CSV demos", () => {
    const regular = parseWildberriesFinanceCsvText(
      readDemoText("wb-finance-api-preview.csv"),
    );
    const large = parseWildberriesFinanceCsvText(
      readDemoText("wb-finance-large-preview.csv"),
    );

    expect(regular.marketplace).toBe("wildberries");
    expect(regular.rows).toHaveLength(2);
    expect(large.marketplace).toBe("wildberries");
    expect(large.rows).toHaveLength(36);
  });

  it("parses the public Ozon finance CSV demo", () => {
    const report = parseOzonFinanceCsvText(
      readDemoText("ozon-finance-preview.csv"),
    );

    expect(report.marketplace).toBe("ozon");
    expect(report.sourceRowCount).toBe(4);
    expect(report.rows).toHaveLength(3);
  });

  it("keeps the unsupported CSV demo rejected by the strict Ozon parser", () => {
    const rows = parseCsvRows(readDemoText("unsupported-finance-format.csv"));

    expect(detectReportMarketplace(rows[0] ?? [])).toBe("ozon");
    expect(() =>
      parseOzonFinanceCsvText(readDemoText("unsupported-finance-format.csv")),
    ).toThrowError(/строка заголовков не найдена/i);
  });

  it("keeps the WB product catalog demo as a clear negative fixture", async () => {
    await expect(
      parseWildberriesApiPreviewWorkbook(
        await readDemoWorkbook("wb-product-catalog-not-finance.xlsx"),
      ),
    ).rejects.toMatchObject({
      code: "WB_PRODUCT_CATALOG_UPLOADED",
    });
  });
});
