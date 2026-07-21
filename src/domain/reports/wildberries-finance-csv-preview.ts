import {
  bigintToSafeNumber,
  ExactNumberError,
  parseInteger,
  parseRublesToKopecks,
} from "./decimal";
import { parseCsvRows } from "./csv";
import type { NormalizedReportRow, ParsedReport, ParseWarning } from "./parser";
import { ReportParseError } from "./wildberries-api-preview";

export { parseCsvRows } from "./csv";

export const WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION =
  "wb:finance-report:api-csv:preview-2026-07";

const MAX_HEADER_SCAN_ROWS = 20;
const MAX_REPORT_ROWS = 100_000;
const MAX_REPORT_COLUMNS = 120;

const REQUIRED_HEADERS = [
  "currency_name",
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
] as const;

const OPTIONAL_MONEY_HEADERS = [
  "acquiring_fee",
  "acceptance",
  "payment_processing",
  "cashback_amount",
  "seller_promo_discount",
  "loyalty_discount",
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];
type OptionalMoneyHeader = (typeof OPTIONAL_MONEY_HEADERS)[number];
type KnownHeader = RequiredHeader | OptionalMoneyHeader | "subject_name";
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
  storageKopecks: bigint;
  returnsKopecks: bigint;
  penaltiesKopecks: bigint;
  otherExpensesKopecks: bigint;
};

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("ru-RU");
}

function isEmptyReportRow(row: CsvRow): boolean {
  return row.every((cell) => cell.trim() === "");
}

function findHeaderRow(rows: readonly CsvRow[]): number {
  const searchLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  for (let index = 0; index < searchLimit; index += 1) {
    const values = new Set(rows[index].map(normalizeHeader));
    const markerCount = [
      "nm_id",
      "barcode",
      "supplier_oper_name",
      "ppvz_for_pay",
    ].filter((header) => values.has(header)).length;

    if (markerCount >= 3) {
      return index;
    }
  }

  throw new ReportParseError(
    "WB_FINANCE_CSV_FORMAT_NOT_RECOGNIZED",
    "Не удалось распознать CSV финансового отчёта Wildberries: строка заголовков не найдена",
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
      `В CSV-отчёте WB не хватает обязательных колонок: ${missing.join(", ")}`,
    );
  }

  const knownHeaders = [
    ...REQUIRED_HEADERS,
    ...OPTIONAL_MONEY_HEADERS,
    "subject_name",
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
  header: RequiredHeader | OptionalMoneyHeader,
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

function classifyOperation(operation: string): "sale" | "return" | "service" {
  const normalized = operation.toLocaleLowerCase("ru-RU");

  if (normalized.includes("возврат")) {
    return "return";
  }

  if (
    normalized.includes("продаж") ||
    normalized.includes("реализац") ||
    normalized.includes("оплата брака")
  ) {
    return "sale";
  }

  return "service";
}

function addExpense(
  aggregate: Aggregate,
  amountKopecks: number,
  target:
    | "logisticsKopecks"
    | "storageKopecks"
    | "penaltiesKopecks"
    | "otherExpensesKopecks",
): void {
  if (amountKopecks >= 0) {
    aggregate[target] += BigInt(amountKopecks);
  } else {
    aggregate[target] -= BigInt(-amountKopecks);
  }
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
}

export function parseWildberriesFinanceCsvRows(
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
    if (isEmptyReportRow(row)) {
      continue;
    }

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

    const sku = readCell(row, columns, "barcode");
    const offerId = readCell(row, columns, "nm_id");
    const operation = readRequiredCell(
      row,
      columns,
      "supplier_oper_name",
      sourceRowNumber,
    );
    const operationKind = classifyOperation(operation);

    if (!sku || !offerId || offerId === "0") {
      skippedServiceRows += 1;
      continue;
    }

    if (operationKind === "service") {
      warnings.push({
        code: "SERVICE_ROW_SKIPPED",
        message:
          "В отчёте есть сервисная операция WB по товару, которую preview-адаптер пока не распределяет по прибыли SKU.",
        sourceRowNumber,
      });
      continue;
    }

    sourceRowCount += 1;
    const productName = readCell(row, columns, "subject_name") || null;
    const quantity = parseQuantity(row, columns, sourceRowNumber);
    const retailAmount = parseMoney(
      row,
      columns,
      "retail_amount",
      sourceRowNumber,
    );
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
    const acquiringFee = parseMoney(
      row,
      columns,
      "acquiring_fee",
      sourceRowNumber,
    );
    const acceptance = parseMoney(row, columns, "acceptance", sourceRowNumber);
    const paymentProcessing = parseMoney(
      row,
      columns,
      "payment_processing",
      sourceRowNumber,
    );
    const cashbackAmount = parseMoney(
      row,
      columns,
      "cashback_amount",
      sourceRowNumber,
    );
    const sellerPromoDiscount = parseMoney(
      row,
      columns,
      "seller_promo_discount",
      sourceRowNumber,
    );
    const loyaltyDiscount = parseMoney(
      row,
      columns,
      "loyalty_discount",
      sourceRowNumber,
    );

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
    };

    if (existing && existing.offerId !== offerId) {
      throw new ReportParseError(
        "SKU_ID_CONFLICT",
        `Для SKU «${sku}» найдены разные идентификаторы Wildberries`,
        sourceRowNumber,
      );
    }

    if (operationKind === "sale") {
      if (quantity <= 0 || retailAmount < 0 || ppvzForPay < 0) {
        throw new ReportParseError(
          "INVALID_OPERATION_SIGN",
          `В строке ${sourceRowNumber} знаки количества или суммы не соответствуют продаже`,
          sourceRowNumber,
        );
      }

      aggregate.quantity += BigInt(quantity);
      aggregate.revenueKopecks += BigInt(retailAmount);
      aggregate.marketplaceCommissionKopecks +=
        BigInt(retailAmount) - BigInt(ppvzForPay);
    } else {
      const returnQuantity = quantity < 0 ? -quantity : quantity;
      const returnRetailAmount =
        retailAmount < 0 ? -retailAmount : retailAmount;
      const returnPpvzForPay = ppvzForPay < 0 ? -ppvzForPay : ppvzForPay;

      aggregate.quantity -= BigInt(returnQuantity);
      aggregate.returnsKopecks += BigInt(returnRetailAmount);
      aggregate.marketplaceCommissionKopecks -=
        BigInt(returnRetailAmount) - BigInt(returnPpvzForPay);
    }

    addExpense(aggregate, delivery, "logisticsKopecks");
    addExpense(aggregate, storage, "storageKopecks");
    addExpense(aggregate, penalty, "penaltiesKopecks");
    addExpense(aggregate, deduction, "otherExpensesKopecks");
    addExpense(aggregate, acquiringFee, "otherExpensesKopecks");
    addExpense(aggregate, acceptance, "otherExpensesKopecks");
    addExpense(aggregate, paymentProcessing, "otherExpensesKopecks");
    addExpense(aggregate, cashbackAmount, "otherExpensesKopecks");
    addExpense(aggregate, sellerPromoDiscount, "otherExpensesKopecks");
    addExpense(aggregate, loyaltyDiscount, "otherExpensesKopecks");

    if (additionalPayment >= 0) {
      aggregate.revenueKopecks += BigInt(additionalPayment);
    } else {
      aggregate.otherExpensesKopecks += BigInt(-additionalPayment);
    }

    aggregates.set(sku, aggregate);
  }

  if (skippedServiceRows > 0) {
    warnings.push({
      code: "SERVICE_ROWS_WITHOUT_SKU_SKIPPED",
      message: `В отчёте есть сервисные строки WB без SKU: ${skippedServiceRows}. Preview-адаптер не распределяет их по товарам.`,
    });
  }

  if (sourceRowCount === 0) {
    throw new ReportParseError(
      "NO_PRODUCT_FINANCE_ROWS",
      "CSV похож на финансовый отчёт WB, но в нём нет товарных строк с SKU, которые можно безопасно посчитать по товарам",
    );
  }

  return {
    marketplace: "wildberries",
    formatVersion: WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
    sourceRowCount,
    rows: Array.from(aggregates.values(), toNormalizedRow),
    warnings,
    missingColumns: [
      "advertisingKopecks",
      "costOfGoodsKopecks",
      "forPayReconciliation",
    ],
  };
}

export function parseWildberriesFinanceCsvText(text: string): ParsedReport {
  return parseWildberriesFinanceCsvRows(parseCsvRows(text));
}

export async function parseWildberriesFinanceCsvFile(
  input: Blob,
): Promise<ParsedReport> {
  try {
    return parseWildberriesFinanceCsvText(await input.text());
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
