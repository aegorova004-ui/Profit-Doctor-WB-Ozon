import { readSheet } from "read-excel-file/universal";
import {
  bigintToSafeNumber,
  ExactNumberError,
  parseInteger,
  parseRublesToKopecks,
} from "./decimal";
import type { NormalizedReportRow, ParsedReport, ParseWarning } from "./parser";

export const WB_API_PREVIEW_FORMAT_VERSION =
  "wb:api-financial-report:preview-2026-07";

const MAX_HEADER_SCAN_ROWS = 20;
const MAX_REPORT_ROWS = 100_000;
const MAX_REPORT_COLUMNS = 100;
const REQUIRED_HEADERS = [
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
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];
type RawCell = string | boolean | Date | null;
type RawRow = readonly RawCell[];

type Aggregate = {
  firstSourceRowNumber: number;
  sku: string;
  offerId: string;
  productName: string | null;
  quantity: bigint;
  revenueKopecks: bigint;
  marketplaceCommissionKopecks: bigint;
  logisticsKopecks: bigint;
  storageKopecks: bigint;
  returnsKopecks: bigint;
  penaltiesKopecks: bigint;
  otherExpensesKopecks: bigint;
  payoutKopecks: bigint;
};

function decodeNumericHtmlEntities(value: string): string {
  return value.replace(/&#(\d+);/g, (_, code: string) =>
    String.fromCodePoint(Number(code)),
  );
}

export class ReportParseError extends Error {
  readonly code: string;
  readonly sourceRowNumber?: number;

  constructor(code: string, message: string, sourceRowNumber?: number) {
    super(message);
    this.name = "ReportParseError";
    this.code = code;
    this.sourceRowNumber = sourceRowNumber;
  }
}

function cellToString(cell: RawCell | undefined): string {
  if (cell === null || cell === undefined) {
    return "";
  }

  if (cell instanceof Date) {
    return cell.toISOString();
  }

  return decodeNumericHtmlEntities(String(cell)).trim();
}

function normalizeHeader(cell: RawCell | undefined): string {
  return cellToString(cell).toLowerCase();
}

function findHeaderRow(rows: readonly RawRow[]): number {
  const searchLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  for (let index = 0; index < searchLimit; index += 1) {
    const values = new Set(rows[index].map(normalizeHeader));
    const markerCount = ["nm_id", "barcode", "doc_type_name", "for_pay"].filter(
      (header) => values.has(header),
    ).length;

    if (markerCount >= 3) {
      return index;
    }
  }

  const firstRowValues = new Set(rows[0]?.map(normalizeHeader) ?? []);
  const catalogMarkerCount = [
    "категория",
    "название",
    "артикул",
    "url",
    "цена",
    "цена со скидкой",
    "производитель",
  ].filter((header) => firstRowValues.has(header)).length;

  if (catalogMarkerCount >= 5) {
    throw new ReportParseError(
      "WB_PRODUCT_CATALOG_UPLOADED",
      "Похоже, выбран товарный каталог Wildberries. Для расчёта прибыли нужен финансовый отчёт с выплатами и удержаниями",
    );
  }

  throw new ReportParseError(
    "WB_FORMAT_NOT_RECOGNIZED",
    "Не удалось распознать финансовый отчёт Wildberries: строка заголовков не найдена",
  );
}

function buildHeaderMap(headerRow: RawRow): Map<RequiredHeader, number> {
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
      `В отчёте не хватает обязательных колонок: ${missing.join(", ")}`,
    );
  }

  return new Map(
    REQUIRED_HEADERS.map((header) => [header, allHeaders.indexOf(header)]),
  );
}

function isEmptyRow(row: RawRow): boolean {
  return row.every((cell) => cellToString(cell) === "");
}

function readRequiredCell(
  row: RawRow,
  columns: ReadonlyMap<RequiredHeader, number>,
  header: RequiredHeader,
  sourceRowNumber: number,
): string {
  const columnIndex = columns.get(header);
  const value = cellToString(
    columnIndex === undefined ? undefined : row[columnIndex],
  );

  if (!value) {
    throw new ReportParseError(
      "EMPTY_REQUIRED_VALUE",
      `В строке ${sourceRowNumber} не заполнено обязательное поле «${header}»`,
      sourceRowNumber,
    );
  }

  return value;
}

function parseMoney(
  row: RawRow,
  columns: ReadonlyMap<RequiredHeader, number>,
  header: RequiredHeader,
  sourceRowNumber: number,
): number {
  try {
    return parseRublesToKopecks(
      readRequiredCell(row, columns, header, sourceRowNumber),
      header,
    );
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

function parseQuantity(
  row: RawRow,
  columns: ReadonlyMap<RequiredHeader, number>,
  sourceRowNumber: number,
): number {
  try {
    return parseInteger(
      readRequiredCell(row, columns, "quantity", sourceRowNumber),
      "quantity",
    );
  } catch (error) {
    if (!(error instanceof ExactNumberError)) {
      throw error;
    }

    throw new ReportParseError(
      "INVALID_QUANTITY",
      `В строке ${sourceRowNumber} поле «quantity» должно быть целым числом`,
      sourceRowNumber,
    );
  }
}

function assertNonNegative(
  value: number,
  header: RequiredHeader,
  sourceRowNumber: number,
): void {
  if (value < 0) {
    throw new ReportParseError(
      "INVALID_EXPENSE_SIGN",
      `В строке ${sourceRowNumber} поле «${header}» не может быть отрицательным для этого формата`,
      sourceRowNumber,
    );
  }
}

function toNormalizedRow(aggregate: Aggregate): NormalizedReportRow {
  if (aggregate.marketplaceCommissionKopecks < 0n) {
    throw new ReportParseError(
      "NEGATIVE_AGGREGATE_COMMISSION",
      `После объединения операций SKU «${aggregate.sku}» комиссия стала отрицательной`,
    );
  }

  const normalized: NormalizedReportRow = {
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
    storageKopecks: bigintToSafeNumber(
      aggregate.storageKopecks,
      "storageKopecks",
    ),
    returnsKopecks: bigintToSafeNumber(
      aggregate.returnsKopecks,
      "returnsKopecks",
    ),
    penaltiesKopecks: bigintToSafeNumber(
      aggregate.penaltiesKopecks,
      "penaltiesKopecks",
    ),
    advertisingKopecks: null,
    costOfGoodsKopecks: null,
    otherExpensesKopecks: bigintToSafeNumber(
      aggregate.otherExpensesKopecks,
      "otherExpensesKopecks",
    ),
  };

  const calculatedPayout =
    aggregate.revenueKopecks -
    aggregate.marketplaceCommissionKopecks -
    aggregate.logisticsKopecks -
    aggregate.storageKopecks -
    aggregate.returnsKopecks -
    aggregate.penaltiesKopecks -
    aggregate.otherExpensesKopecks;

  if (
    calculatedPayout - aggregate.payoutKopecks > 1n ||
    aggregate.payoutKopecks - calculatedPayout > 1n
  ) {
    throw new ReportParseError(
      "PAYOUT_RECONCILIATION_FAILED",
      `Не удалось сверить начисления и сумму к выплате для SKU «${aggregate.sku}»`,
    );
  }

  return normalized;
}

export function parseWildberriesApiRows(
  rawRows: readonly RawRow[],
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

  for (let index = headerIndex + 1; index < rawRows.length; index += 1) {
    const row = rawRows[index];
    if (isEmptyRow(row)) {
      continue;
    }

    sourceRowCount += 1;
    const sourceRowNumber = index + 1;
    const currency = readRequiredCell(
      row,
      columns,
      "currency_name",
      sourceRowNumber,
    ).toUpperCase();
    if (currency !== "RUB" && currency !== "RUR") {
      throw new ReportParseError(
        "UNSUPPORTED_CURRENCY",
        `В строке ${sourceRowNumber} указана неподдерживаемая валюта`,
        sourceRowNumber,
      );
    }

    const sku = readRequiredCell(row, columns, "barcode", sourceRowNumber);
    const offerId = readRequiredCell(row, columns, "nm_id", sourceRowNumber);
    const productName = readRequiredCell(
      row,
      columns,
      "subject_name",
      sourceRowNumber,
    );
    const operation = readRequiredCell(
      row,
      columns,
      "doc_type_name",
      sourceRowNumber,
    ).toLocaleLowerCase("ru-RU");
    const quantity = parseQuantity(row, columns, sourceRowNumber);
    const retailAmount = parseMoney(
      row,
      columns,
      "retail_amount",
      sourceRowNumber,
    );
    const payout = parseMoney(row, columns, "for_pay", sourceRowNumber);
    const ppvzForPay = parseMoney(
      row,
      columns,
      "ppvz_for_pay",
      sourceRowNumber,
    );
    const delivery = parseMoney(row, columns, "delivery_rub", sourceRowNumber);
    const penalty = parseMoney(row, columns, "penalty", sourceRowNumber);
    const additionalPayment = parseMoney(
      row,
      columns,
      "additional_payment",
      sourceRowNumber,
    );
    const storage = parseMoney(row, columns, "storage_fee", sourceRowNumber);
    const deduction = parseMoney(row, columns, "deduction", sourceRowNumber);

    assertNonNegative(delivery, "delivery_rub", sourceRowNumber);
    assertNonNegative(penalty, "penalty", sourceRowNumber);
    assertNonNegative(storage, "storage_fee", sourceRowNumber);
    assertNonNegative(deduction, "deduction", sourceRowNumber);

    const isSale = operation === "продажа";
    const isReturn = operation === "возврат";
    if (!isSale && !isReturn) {
      throw new ReportParseError(
        "UNSUPPORTED_OPERATION",
        `В строке ${sourceRowNumber} указан неподдерживаемый тип операции`,
        sourceRowNumber,
      );
    }

    if (
      (isSale && (quantity <= 0 || retailAmount < 0 || ppvzForPay < 0)) ||
      (isReturn && (quantity >= 0 || retailAmount > 0 || ppvzForPay > 0))
    ) {
      throw new ReportParseError(
        "INVALID_OPERATION_SIGN",
        `В строке ${sourceRowNumber} знаки количества или суммы не соответствуют типу операции`,
        sourceRowNumber,
      );
    }

    const commissionAdjustment = BigInt(retailAmount) - BigInt(ppvzForPay);
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
      storageKopecks: 0n,
      returnsKopecks: 0n,
      penaltiesKopecks: 0n,
      otherExpensesKopecks: 0n,
      payoutKopecks: 0n,
    };

    if (existing && existing.offerId !== offerId) {
      throw new ReportParseError(
        "SKU_ID_CONFLICT",
        `Для SKU «${sku}» найдены разные идентификаторы Wildberries`,
        sourceRowNumber,
      );
    }

    if (existing && existing.productName !== productName) {
      warnings.push({
        code: "PRODUCT_NAME_CHANGED",
        message: `Для SKU «${sku}» найдено несколько названий; показано первое`,
        sourceRowNumber,
      });
    }

    aggregate.quantity += BigInt(quantity);
    aggregate.marketplaceCommissionKopecks += commissionAdjustment;
    aggregate.logisticsKopecks += BigInt(delivery);
    aggregate.storageKopecks += BigInt(storage);
    aggregate.penaltiesKopecks += BigInt(penalty);
    aggregate.otherExpensesKopecks += BigInt(deduction);
    aggregate.payoutKopecks += BigInt(payout);

    if (isSale) {
      aggregate.revenueKopecks += BigInt(retailAmount);
    } else {
      aggregate.returnsKopecks += BigInt(-retailAmount);
    }

    if (additionalPayment >= 0) {
      aggregate.revenueKopecks += BigInt(additionalPayment);
    } else {
      aggregate.otherExpensesKopecks += BigInt(-additionalPayment);
    }

    aggregates.set(sku, aggregate);
  }

  if (sourceRowCount === 0) {
    throw new ReportParseError(
      "NO_DATA_ROWS",
      "В отчёте нет строк с финансовыми операциями",
    );
  }

  return {
    marketplace: "wildberries",
    formatVersion: WB_API_PREVIEW_FORMAT_VERSION,
    sourceRowCount,
    rows: Array.from(aggregates.values(), toNormalizedRow),
    warnings,
    missingColumns: ["advertisingKopecks", "costOfGoodsKopecks"],
  };
}

export async function parseWildberriesApiPreviewWorkbook(
  input: Blob | ArrayBuffer,
): Promise<ParsedReport> {
  let data: RawRow[];

  try {
    data = (await readSheet<string>(input, {
      parseNumber: (value) => value,
    })) as unknown as RawRow[];
  } catch {
    throw new ReportParseError(
      "XLSX_READ_FAILED",
      "Не удалось прочитать XLSX. Экспортируйте отчёт заново без пароля и макросов",
    );
  }

  return parseWildberriesApiRows(data);
}
