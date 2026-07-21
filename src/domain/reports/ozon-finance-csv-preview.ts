import {
  bigintToSafeNumber,
  ExactNumberError,
  parseInteger,
  parseRublesToKopecks,
} from "./decimal";
import type { NormalizedReportRow, ParsedReport, ParseWarning } from "./parser";
import { parseCsvRows } from "./wildberries-finance-csv-preview";
import { ReportParseError } from "./wildberries-api-preview";

export const OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION =
  "ozon:finance-report:csv:preview-2026-07";

const MAX_HEADER_SCAN_ROWS = 20;
const MAX_REPORT_ROWS = 100_000;
const MAX_REPORT_COLUMNS = 80;

const REQUIRED_HEADERS = [
  "sku",
  "offer_id",
  "тип начисления",
  "количество",
  "сумма итого, руб.",
  "комиссия за продажу",
  "логистика",
  "обработка отправления",
  "возвраты",
  "прочие услуги",
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];
type KnownHeader = RequiredHeader | "название товара" | "дата операции";
type CsvRow = readonly string[];

type Aggregate = {
  firstSourceRowNumber: number;
  sku: string;
  offerId: string;
  productName: string | null;
  quantity: bigint;
  revenueKopecks: bigint;
  marketplaceCommissionKopecks: bigint;
  logisticsKopecks: bigint;
  returnsKopecks: bigint;
  otherExpensesKopecks: bigint;
};

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function isEmptyRow(row: CsvRow): boolean {
  return row.every((cell) => cell.trim() === "");
}

function findHeaderRow(rows: readonly CsvRow[]): number {
  const searchLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  for (let index = 0; index < searchLimit; index += 1) {
    const values = new Set(rows[index].map(normalizeHeader));
    const markerCount = ["sku", "offer_id", "тип начисления"].filter((header) =>
      values.has(header),
    ).length;

    if (markerCount === 3) {
      return index;
    }
  }

  throw new ReportParseError(
    "OZON_FINANCE_CSV_FORMAT_NOT_RECOGNIZED",
    "Не удалось распознать CSV финансового отчёта Ozon: строка заголовков не найдена",
  );
}

function buildHeaderMap(headerRow: CsvRow): Map<KnownHeader, number> {
  const allHeaders = headerRow.map(normalizeHeader);
  const duplicate = allHeaders.find(
    (header, index) => header && allHeaders.indexOf(header) !== index,
  );

  if (duplicate) {
    throw new ReportParseError(
      "DUPLICATE_COLUMN",
      `В отчёте повторяется колонка «${duplicate}»`,
    );
  }

  const missing = REQUIRED_HEADERS.filter(
    (required) => !allHeaders.includes(required),
  );

  if (missing.length > 0) {
    throw new ReportParseError(
      "MISSING_COLUMNS",
      `В CSV-отчёте Ozon не хватает обязательных колонок: ${missing.join(", ")}`,
    );
  }

  const knownHeaders = [
    ...REQUIRED_HEADERS,
    "название товара",
    "дата операции",
  ] as const;

  return new Map(
    knownHeaders
      .map((header) => [header, allHeaders.indexOf(header)] as const)
      .filter(([, index]) => index >= 0),
  );
}

function readCell(
  row: CsvRow,
  columns: ReadonlyMap<KnownHeader, number>,
  header: KnownHeader,
): string {
  const columnIndex = columns.get(header);
  return (columnIndex === undefined ? "" : (row[columnIndex] ?? "")).trim();
}

function readRequiredCell(
  row: CsvRow,
  columns: ReadonlyMap<KnownHeader, number>,
  header: RequiredHeader,
  sourceRowNumber: number,
): string {
  const value = readCell(row, columns, header);

  if (!value) {
    throw new ReportParseError(
      "EMPTY_REQUIRED_VALUE",
      `В строке ${sourceRowNumber} не заполнено обязательное поле «${header}»`,
      sourceRowNumber,
    );
  }

  return value;
}

function parseMoneyValue(
  value: string,
  header: KnownHeader,
  sourceRowNumber: number,
): number {
  if (!value) {
    return 0;
  }

  try {
    return parseRublesToKopecks(value, header);
  } catch (error) {
    if (!(error instanceof ExactNumberError)) {
      throw error;
    }

    throw new ReportParseError(
      "INVALID_MONEY",
      `В строке ${sourceRowNumber} поле «${header}» содержит некорректную сумму`,
      sourceRowNumber,
    );
  }
}

function parseMoney(
  row: CsvRow,
  columns: ReadonlyMap<KnownHeader, number>,
  header: RequiredHeader,
  sourceRowNumber: number,
): number {
  return parseMoneyValue(
    readCell(row, columns, header),
    header,
    sourceRowNumber,
  );
}

function parseQuantity(
  row: CsvRow,
  columns: ReadonlyMap<KnownHeader, number>,
  sourceRowNumber: number,
): number {
  try {
    return parseInteger(
      readRequiredCell(row, columns, "количество", sourceRowNumber),
      "quantity",
    );
  } catch (error) {
    if (!(error instanceof ExactNumberError)) {
      throw error;
    }

    throw new ReportParseError(
      "INVALID_QUANTITY",
      `В строке ${sourceRowNumber} поле «количество» должно быть целым числом`,
      sourceRowNumber,
    );
  }
}

function classifyOperation(operation: string): "sale" | "return" | "service" {
  const normalized = operation.toLocaleLowerCase("ru-RU");

  if (normalized.includes("возврат")) {
    return "return";
  }

  if (
    normalized.includes("доставка покупателю") ||
    normalized.includes("продаж") ||
    normalized.includes("реализац")
  ) {
    return "sale";
  }

  return "service";
}

function addExpense(
  aggregate: Aggregate,
  amountKopecks: number,
  target:
    | "marketplaceCommissionKopecks"
    | "logisticsKopecks"
    | "returnsKopecks"
    | "otherExpensesKopecks",
): void {
  aggregate[target] += BigInt(Math.abs(amountKopecks));
}

function toNormalizedRow(aggregate: Aggregate): NormalizedReportRow {
  return {
    sourceRowNumber: aggregate.firstSourceRowNumber,
    sku: aggregate.sku,
    offerId: aggregate.offerId,
    productName: aggregate.productName,
    quantity: bigintToSafeNumber(aggregate.quantity, "quantity"),
    revenueKopecks: bigintToSafeNumber(
      aggregate.revenueKopecks,
      "revenueKopecks",
    ),
    marketplaceCommissionKopecks: bigintToSafeNumber(
      aggregate.marketplaceCommissionKopecks,
      "marketplaceCommissionKopecks",
    ),
    logisticsKopecks: bigintToSafeNumber(
      aggregate.logisticsKopecks,
      "logisticsKopecks",
    ),
    storageKopecks: null,
    returnsKopecks: bigintToSafeNumber(
      aggregate.returnsKopecks,
      "returnsKopecks",
    ),
    penaltiesKopecks: null,
    advertisingKopecks: null,
    costOfGoodsKopecks: null,
    otherExpensesKopecks: bigintToSafeNumber(
      aggregate.otherExpensesKopecks,
      "otherExpensesKopecks",
    ),
  };
}

export function parseOzonFinanceCsvRows(
  rawRows: readonly CsvRow[],
): ParsedReport {
  if (rawRows.length > MAX_REPORT_ROWS + MAX_HEADER_SCAN_ROWS) {
    throw new ReportParseError(
      "TOO_MANY_ROWS",
      `В отчёте больше ${MAX_REPORT_ROWS.toLocaleString("ru-RU")} строк`,
    );
  }

  if (rawRows.some((row) => row.length > MAX_REPORT_COLUMNS)) {
    throw new ReportParseError(
      "TOO_MANY_COLUMNS",
      `В отчёте больше ${MAX_REPORT_COLUMNS} колонок`,
    );
  }

  const headerIndex = findHeaderRow(rawRows);
  const columns = buildHeaderMap(rawRows[headerIndex]);
  const aggregates = new Map<string, Aggregate>();
  const warnings: ParseWarning[] = [];
  let sourceRowCount = 0;
  let skippedServiceRows = 0;

  for (let index = headerIndex + 1; index < rawRows.length; index += 1) {
    const row = rawRows[index];
    if (isEmptyRow(row)) {
      continue;
    }

    const sourceRowNumber = index + 1;
    const sku = readCell(row, columns, "sku");
    const offerId = readCell(row, columns, "offer_id");
    const operation = readRequiredCell(
      row,
      columns,
      "тип начисления",
      sourceRowNumber,
    );
    const operationKind = classifyOperation(operation);

    if (!sku || !offerId) {
      skippedServiceRows += 1;
      continue;
    }

    if (operationKind === "service") {
      throw new ReportParseError(
        "UNSUPPORTED_OZON_OPERATION",
        `В строке ${sourceRowNumber} тип начисления Ozon пока не поддерживается preview-адаптером`,
        sourceRowNumber,
      );
    }

    sourceRowCount += 1;
    const productName = readCell(row, columns, "название товара") || null;
    const quantity = parseQuantity(row, columns, sourceRowNumber);
    const total = parseMoney(
      row,
      columns,
      "сумма итого, руб.",
      sourceRowNumber,
    );
    const commission = parseMoney(
      row,
      columns,
      "комиссия за продажу",
      sourceRowNumber,
    );
    const logistics = parseMoney(row, columns, "логистика", sourceRowNumber);
    const processing = parseMoney(
      row,
      columns,
      "обработка отправления",
      sourceRowNumber,
    );
    const returns = parseMoney(row, columns, "возвраты", sourceRowNumber);
    const other = parseMoney(row, columns, "прочие услуги", sourceRowNumber);

    const existing = aggregates.get(sku);
    const aggregate: Aggregate = existing ?? {
      firstSourceRowNumber: sourceRowNumber,
      sku,
      offerId,
      productName,
      quantity: 0n,
      revenueKopecks: 0n,
      marketplaceCommissionKopecks: 0n,
      logisticsKopecks: 0n,
      returnsKopecks: 0n,
      otherExpensesKopecks: 0n,
    };

    if (existing && existing.offerId !== offerId) {
      throw new ReportParseError(
        "SKU_ID_CONFLICT",
        `Для SKU «${sku}» найдены разные offer_id Ozon`,
        sourceRowNumber,
      );
    }

    if (operationKind === "sale") {
      if (quantity <= 0 || total < 0) {
        throw new ReportParseError(
          "INVALID_OPERATION_SIGN",
          `В строке ${sourceRowNumber} знаки количества или суммы не соответствуют продаже`,
          sourceRowNumber,
        );
      }

      aggregate.quantity += BigInt(quantity);
      aggregate.revenueKopecks += BigInt(total);
    } else {
      if (quantity >= 0 || total > 0) {
        throw new ReportParseError(
          "INVALID_OPERATION_SIGN",
          `В строке ${sourceRowNumber} знаки количества или суммы не соответствуют возврату`,
          sourceRowNumber,
        );
      }

      aggregate.quantity -= BigInt(Math.abs(quantity));
      addExpense(aggregate, returns || total, "returnsKopecks");
    }

    addExpense(aggregate, commission, "marketplaceCommissionKopecks");
    addExpense(aggregate, logistics, "logisticsKopecks");
    addExpense(aggregate, processing, "otherExpensesKopecks");
    addExpense(aggregate, other, "otherExpensesKopecks");

    aggregates.set(sku, aggregate);
  }

  if (skippedServiceRows > 0) {
    warnings.push({
      code: "SERVICE_ROWS_WITHOUT_SKU_SKIPPED",
      message: `В отчёте есть сервисные строки Ozon без SKU: ${skippedServiceRows}. Preview-адаптер не распределяет их по товарам.`,
    });
  }

  if (sourceRowCount === 0) {
    throw new ReportParseError(
      "NO_PRODUCT_FINANCE_ROWS",
      "CSV похож на финансовый отчёт Ozon, но в нём нет товарных строк с SKU, которые можно безопасно посчитать по товарам",
    );
  }

  return {
    marketplace: "ozon",
    formatVersion: OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
    sourceRowCount,
    rows: Array.from(aggregates.values(), toNormalizedRow),
    warnings,
    missingColumns: [
      "storageKopecks",
      "penaltiesKopecks",
      "advertisingKopecks",
      "costOfGoodsKopecks",
      "forPayReconciliation",
    ],
  };
}

export function parseOzonFinanceCsvText(text: string): ParsedReport {
  return parseOzonFinanceCsvRows(parseCsvRows(text));
}

export async function parseOzonFinanceCsvFile(
  input: Blob,
): Promise<ParsedReport> {
  try {
    return parseOzonFinanceCsvText(await input.text());
  } catch (error) {
    if (error instanceof ReportParseError) {
      throw error;
    }

    throw new ReportParseError(
      "CSV_READ_FAILED",
      "Не удалось прочитать CSV. Экспортируйте отчёт заново в UTF-8 или XLSX",
    );
  }
}
