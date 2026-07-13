import type { Sheet, SheetData } from "write-excel-file/browser";
import type { ReportAnalysis } from "./analyze-report";
import {
  diagnoseReport,
  type ExpenseDriver,
  type SkuDiagnosis,
} from "./diagnose-report";

export const REPORT_EXPORT_VERSION = "profit-doctor:sku-profitability:v1";
export const REPORT_FORMULA_VERSION = "profit-doctor:operating-profit:v1";
export const REPORT_FORMULA_TEXT =
  "Результат = выручка − удержания маркетплейса − себестоимость";

const RUBLES_FORMAT = '#,##0.00 "₽";[Red]-#,##0.00 "₽";-';
const HEADER_BACKGROUND = "#0B281C";
const ACCENT_COLOR = "#B8F36B";
const LIGHT_BACKGROUND = "#EFF5EC";
const BORDER_COLOR = "#D6E0D2";

const EXPENSE_LABELS: Record<ExpenseDriver, string> = {
  "cost-of-goods": "Себестоимость",
  commission: "Комиссия маркетплейса",
  logistics: "Логистика",
  storage: "Хранение",
  returns: "Возвраты",
  penalties: "Штрафы",
  advertising: "Реклама",
  other: "Прочие удержания",
};

const EXPENSE_ACTIONS: Record<ExpenseDriver, string> = {
  "cost-of-goods":
    "Проверьте закупочную цену, комплектацию и фактическую себестоимость.",
  commission:
    "Проверьте категорию товара и ставку комиссии в кабинете маркетплейса.",
  logistics: "Проверьте габариты, упаковку и схему поставки.",
  storage: "Проверьте оборачиваемость и остатки, увеличивающие хранение.",
  returns: "Проверьте причины возвратов, карточку товара и комплектацию.",
  penalties: "Разберите штрафы и устраните повторяющиеся причины.",
  advertising: "Проверьте кампании и расходы без подтверждённых продаж.",
  other: "Раскройте прочие удержания и проверьте их назначение.",
};

const MISSING_FIELD_LABELS: Record<string, string> = {
  marketplaceCommissionKopecks: "комиссия",
  logisticsKopecks: "логистика",
  storageKopecks: "хранение",
  returnsKopecks: "возвраты",
  penaltiesKopecks: "штрафы",
  advertisingKopecks: "реклама",
  costOfGoodsKopecks: "себестоимость",
  otherExpensesKopecks: "прочие удержания",
};

type ExportRow = {
  priority: number | null;
  status: string;
  productName: string;
  sku: string;
  offerId: string;
  quantity: number;
  revenueKopecks: number;
  marketplaceCommissionKopecks: number | null;
  logisticsKopecks: number | null;
  storageKopecks: number | null;
  returnsKopecks: number | null;
  penaltiesKopecks: number | null;
  advertisingKopecks: number | null;
  otherExpensesKopecks: number | null;
  marketplaceExpensesKopecks: number;
  unitCostKopecks: number | null;
  costOfGoodsKopecks: number | null;
  operatingProfitKopecks: number;
  breakEvenGapKopecks: number;
  maxAffordableUnitCostKopecks: number | null;
  largestExpense: string;
  recommendation: string;
  costSource: string;
  missingFields: string;
  sourceRowNumber: number;
};

export type ReportExportInput = {
  analysis: ReportAnalysis;
  sourceFileName: string;
  createdAtIso: string;
};

function statusLabel(diagnosis: SkuDiagnosis): string {
  switch (diagnosis.status) {
    case "loss":
      return "Убыток";
    case "missing-cost":
      return "Нужна себестоимость";
    case "positive-estimate":
      return "Оценка: пока в плюсе";
    case "positive":
      return "Положительный результат";
  }
}

function costSourceLabel(row: ReportAnalysis["rows"][number]): string {
  switch (row.costOfGoodsSource) {
    case "user-unit-cost":
      return "Введена пользователем за единицу";
    case "report":
      return "Исходный отчёт";
    case "missing":
      return "Нет данных";
  }
}

function recommendationText(diagnosis: SkuDiagnosis): string {
  if (diagnosis.status === "missing-cost") {
    return "Добавьте себестоимость единицы, чтобы определить запас до безубыточности.";
  }

  if (diagnosis.status !== "loss") {
    return diagnosis.status === "positive-estimate"
      ? "Сверьте результат с рекламой и другими расходами, которых нет в отчёте."
      : "Контролируйте положительный запас при следующем обновлении отчёта.";
  }

  const action = diagnosis.largestKnownExpense
    ? EXPENSE_ACTIONS[diagnosis.largestKnownExpense.driver]
    : "Проверьте выручку и все доступные расходы по SKU.";

  return diagnosis.lossBeforeCostOfGoods
    ? `Удержания маркетплейса уже выше выручки. ${action}`
    : `Улучшите результат минимум на ${formatCsvRubles(
        diagnosis.breakEvenGapKopecks,
      )} ₽ за период. ${action}`;
}

function createExportRows(analysis: ReportAnalysis): ExportRow[] {
  const diagnosis = diagnoseReport(analysis);
  const diagnosisBySku = new Map(diagnosis.rows.map((row) => [row.sku, row]));

  return analysis.rows
    .map((row) => {
      const rowDiagnosis = diagnosisBySku.get(row.sku);
      if (!rowDiagnosis) {
        throw new RangeError(`Diagnosis is missing for SKU ${row.sku}`);
      }

      const priorityIndex = diagnosis.prioritySkus.indexOf(row.sku);
      const largestExpense = rowDiagnosis.largestKnownExpense;

      return {
        priority: priorityIndex >= 0 ? priorityIndex + 1 : null,
        status: statusLabel(rowDiagnosis),
        productName: row.productName ?? "",
        sku: row.sku,
        offerId: row.offerId ?? "",
        quantity: row.quantity,
        revenueKopecks: row.profit.revenueKopecks,
        marketplaceCommissionKopecks: row.marketplaceCommissionKopecks,
        logisticsKopecks: row.logisticsKopecks,
        storageKopecks: row.storageKopecks,
        returnsKopecks: row.returnsKopecks,
        penaltiesKopecks: row.penaltiesKopecks,
        advertisingKopecks: row.advertisingKopecks,
        otherExpensesKopecks: row.otherExpensesKopecks,
        marketplaceExpensesKopecks: row.profit.marketplaceExpensesKopecks,
        unitCostKopecks: row.unitCostKopecks,
        costOfGoodsKopecks: row.profit.costOfGoodsKopecks,
        operatingProfitKopecks: row.profit.operatingProfitKopecks,
        breakEvenGapKopecks: rowDiagnosis.breakEvenGapKopecks,
        maxAffordableUnitCostKopecks: rowDiagnosis.maxAffordableUnitCostKopecks,
        largestExpense: largestExpense
          ? `${EXPENSE_LABELS[largestExpense.driver]}: ${formatCsvRubles(
              largestExpense.amountKopecks,
            )} ₽`
          : "",
        recommendation: recommendationText(rowDiagnosis),
        costSource: costSourceLabel(row),
        missingFields: row.profit.missingFields
          .map((field) => MISSING_FIELD_LABELS[field] ?? field)
          .join(", "),
        sourceRowNumber: row.sourceRowNumber,
      };
    })
    .sort((left, right) => {
      if (left.priority === null && right.priority === null) return 0;
      if (left.priority === null) return 1;
      if (right.priority === null) return -1;
      return left.priority - right.priority;
    });
}

function formatCsvRubles(kopecks: number): string {
  const value = BigInt(kopecks);
  const negative = value < 0n;
  const absolute = negative ? -value : value;

  return `${negative ? "-" : ""}${absolute / 100n},${(absolute % 100n)
    .toString()
    .padStart(2, "0")}`;
}

function protectSpreadsheetText(value: string): string {
  const normalized = value.replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
    " ",
  );
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function csvCell(value: string | number | null, userText = false): string {
  const text = value === null ? "" : String(value);
  const safeText = userText ? protectSpreadsheetText(text) : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function csvMoney(value: number | null): string {
  return csvCell(value === null ? "" : formatCsvRubles(value));
}

export function buildReportCsv(input: ReportExportInput): string {
  const { analysis, sourceFileName, createdAtIso } = input;
  const rows = createExportRows(analysis);
  const metadata = [
    ["Profit Doctor — анализ прибыльности SKU"],
    ["Исходный файл", protectSpreadsheetText(sourceFileName)],
    ["Создан", createdAtIso],
    ["Маркетплейс", analysis.marketplace],
    ["Версия формата отчёта", analysis.formatVersion],
    ["Версия экспорта", REPORT_EXPORT_VERSION],
    ["Версия формулы", REPORT_FORMULA_VERSION],
    ["Формула", REPORT_FORMULA_TEXT],
    [
      "Ограничение",
      "Результат не является чистой прибылью, если в отчёте отсутствуют реклама, налоги или другие расходы.",
    ],
  ];
  const headers = [
    "Приоритет",
    "Статус",
    "Товар",
    "SKU",
    "Артикул",
    "Количество, шт.",
    "Выручка, ₽",
    "Комиссия, ₽",
    "Логистика, ₽",
    "Хранение, ₽",
    "Возвраты, ₽",
    "Штрафы, ₽",
    "Реклама, ₽",
    "Прочие удержания, ₽",
    "Удержания маркетплейса, ₽",
    "Себестоимость единицы, ₽",
    "Себестоимость, ₽",
    "Результат, ₽",
    "До безубыточности, ₽",
    "Предельная себестоимость единицы, ₽",
    "Крупнейшая известная статья",
    "Рекомендация",
    "Источник себестоимости",
    "Не хватает данных",
    "Первая строка источника",
    "Версия формата источника",
  ];
  const csvRows = rows.map((row) => [
    csvCell(row.priority),
    csvCell(row.status),
    csvCell(row.productName, true),
    csvCell(row.sku, true),
    csvCell(row.offerId, true),
    csvCell(row.quantity),
    csvMoney(row.revenueKopecks),
    csvMoney(row.marketplaceCommissionKopecks),
    csvMoney(row.logisticsKopecks),
    csvMoney(row.storageKopecks),
    csvMoney(row.returnsKopecks),
    csvMoney(row.penaltiesKopecks),
    csvMoney(row.advertisingKopecks),
    csvMoney(row.otherExpensesKopecks),
    csvMoney(row.marketplaceExpensesKopecks),
    csvMoney(row.unitCostKopecks),
    csvMoney(row.costOfGoodsKopecks),
    csvMoney(row.operatingProfitKopecks),
    csvMoney(row.breakEvenGapKopecks),
    csvMoney(row.maxAffordableUnitCostKopecks),
    csvCell(row.largestExpense),
    csvCell(row.recommendation),
    csvCell(row.costSource),
    csvCell(row.missingFields),
    csvCell(row.sourceRowNumber),
    csvCell(analysis.formatVersion),
  ]);

  return `\uFEFF${[
    ...metadata.map((row) =>
      row.map((cell, index) => csvCell(cell, index === 1)).join(";"),
    ),
    "",
    headers.map((header) => csvCell(header)).join(";"),
    ...csvRows.map((row) => row.join(";")),
  ].join("\r\n")}`;
}

function stringCell(value: string, overrides: Record<string, unknown> = {}) {
  return {
    value,
    type: String,
    alignVertical: "center" as const,
    ...overrides,
  };
}

function moneyCell(kopecks: number | null) {
  if (kopecks === null) {
    return stringCell("Нет данных", { textColor: "#77827B" });
  }

  return {
    value: `=${kopecks}/100`,
    type: "Formula" as const,
    format: RUBLES_FORMAT,
    align: "right" as const,
    alignVertical: "center" as const,
  };
}

function sectionRow(title: string, columnSpan: number) {
  return [
    stringCell(title, {
      columnSpan,
      backgroundColor: HEADER_BACKGROUND,
      textColor: "#FFFFFF",
      fontWeight: "bold",
      height: 26,
    }),
    ...Array.from({ length: columnSpan - 1 }, () => null),
  ];
}

function metadataRow(label: string, value: string, columnSpan: number) {
  return [
    stringCell(label, { fontWeight: "bold", textColor: "#516159" }),
    stringCell(value, {
      columnSpan: columnSpan - 1,
      wrap: true,
      bottomBorderColor: BORDER_COLOR,
      bottomBorderStyle: "thin",
    }),
    ...Array.from({ length: columnSpan - 2 }, () => null),
  ];
}

function headerCell(value: string) {
  return stringCell(value, {
    backgroundColor: HEADER_BACKGROUND,
    textColor: "#FFFFFF",
    fontWeight: "bold",
    wrap: true,
    height: 42,
    bottomBorderColor: ACCENT_COLOR,
    bottomBorderStyle: "medium",
  });
}

export function buildReportWorkbookSheets<FileContent = Blob>(
  input: ReportExportInput,
): Sheet<FileContent>[] {
  const { analysis, sourceFileName, createdAtIso } = input;
  const diagnosis = diagnoseReport(analysis);
  const rows = createExportRows(analysis);
  const summaryColumnCount = 4;
  const summary: SheetData = [
    [
      stringCell("Profit Doctor — анализ прибыльности SKU", {
        columnSpan: summaryColumnCount,
        backgroundColor: HEADER_BACKGROUND,
        textColor: "#FFFFFF",
        fontSize: 20,
        fontWeight: "bold",
        height: 38,
      }),
      null,
      null,
      null,
    ],
    [
      stringCell(
        "Расчёт по известным расходам. Положительная сумма не является чистой прибылью, если часть расходов отсутствует.",
        {
          columnSpan: summaryColumnCount,
          backgroundColor: LIGHT_BACKGROUND,
          textColor: "#526058",
          wrap: true,
          height: 36,
        },
      ),
      null,
      null,
      null,
    ],
    [],
    sectionRow("Метаданные и методика", summaryColumnCount),
    metadataRow("Исходный файл", sourceFileName, summaryColumnCount),
    metadataRow("Создан (UTC)", createdAtIso, summaryColumnCount),
    metadataRow("Маркетплейс", analysis.marketplace, summaryColumnCount),
    metadataRow(
      "Версия формата отчёта",
      analysis.formatVersion,
      summaryColumnCount,
    ),
    metadataRow("Версия экспорта", REPORT_EXPORT_VERSION, summaryColumnCount),
    metadataRow("Версия формулы", REPORT_FORMULA_VERSION, summaryColumnCount),
    metadataRow("Формула", REPORT_FORMULA_TEXT, summaryColumnCount),
    [],
    sectionRow("Итоги", summaryColumnCount),
    [
      headerCell("Показатель"),
      headerCell("Сумма"),
      headerCell("Статус"),
      headerCell("Комментарий"),
    ],
    [
      stringCell("Выручка"),
      moneyCell(analysis.totalRevenueKopecks),
      stringCell("Из отчёта"),
      stringCell(`${analysis.sourceRowCount} операций`, { wrap: true }),
    ],
    [
      stringCell("Удержания маркетплейса"),
      moneyCell(analysis.totalKnownExpensesKopecks),
      stringCell("По известным полям"),
      stringCell("Без себестоимости", { wrap: true }),
    ],
    [
      stringCell("Себестоимость"),
      moneyCell(analysis.totalKnownCostOfGoodsKopecks),
      stringCell(
        analysis.missingCostSkuCount > 0 ? "Неполные данные" : "Заполнено",
      ),
      stringCell(
        analysis.missingCostSkuCount > 0
          ? `Не хватает для ${analysis.missingCostSkuCount} SKU`
          : "Есть для всех SKU",
        { wrap: true },
      ),
    ],
    [
      stringCell("Результат"),
      moneyCell(analysis.estimatedProfitKopecks),
      stringCell(
        analysis.rows.some((row) => row.profit.isEstimate)
          ? "Оценка"
          : "Полный результат",
      ),
      stringCell("До налогов и расходов вне отчёта", { wrap: true }),
    ],
    [
      stringCell("Убыток проблемных SKU"),
      moneyCell(diagnosis.totalLossKopecks),
      stringCell(`${diagnosis.lossSkuCount} SKU`),
      stringCell("Без взаимозачёта с прибыльными SKU", { wrap: true }),
    ],
    [
      stringCell("Положительный запас"),
      moneyCell(diagnosis.totalPositiveBufferKopecks),
      stringCell("По известным расходам"),
      stringCell("Не включает SKU без себестоимости", { wrap: true }),
    ],
  ];

  if (analysis.warnings.length > 0) {
    summary.push(
      [],
      sectionRow("Предупреждения", summaryColumnCount),
      ...analysis.warnings.map((warning) => [
        stringCell(warning.code, { fontWeight: "bold" }),
        stringCell(warning.message, {
          columnSpan: 3,
          wrap: true,
          backgroundColor: "#FFF7E6",
        }),
        null,
        null,
      ]),
    );
  }

  const skuHeaders = [
    "Приоритет",
    "Статус",
    "Товар",
    "SKU",
    "Артикул",
    "Количество, шт.",
    "Выручка",
    "Комиссия",
    "Логистика",
    "Хранение",
    "Возвраты",
    "Штрафы",
    "Реклама",
    "Прочие удержания",
    "Удержания маркетплейса",
    "Себестоимость единицы",
    "Себестоимость",
    "Результат",
    "До безубыточности",
    "Предельная себестоимость единицы",
    "Крупнейшая известная статья",
    "Рекомендация",
    "Источник себестоимости",
    "Не хватает данных",
    "Первая строка источника",
    "Версия формата источника",
  ];
  const skuData: SheetData = [
    skuHeaders.map(headerCell),
    ...rows.map((row) => [
      row.priority,
      stringCell(row.status),
      stringCell(row.productName),
      stringCell(row.sku),
      stringCell(row.offerId),
      row.quantity,
      moneyCell(row.revenueKopecks),
      moneyCell(row.marketplaceCommissionKopecks),
      moneyCell(row.logisticsKopecks),
      moneyCell(row.storageKopecks),
      moneyCell(row.returnsKopecks),
      moneyCell(row.penaltiesKopecks),
      moneyCell(row.advertisingKopecks),
      moneyCell(row.otherExpensesKopecks),
      moneyCell(row.marketplaceExpensesKopecks),
      moneyCell(row.unitCostKopecks),
      moneyCell(row.costOfGoodsKopecks),
      moneyCell(row.operatingProfitKopecks),
      moneyCell(row.breakEvenGapKopecks),
      moneyCell(row.maxAffordableUnitCostKopecks),
      stringCell(row.largestExpense, { wrap: true }),
      stringCell(row.recommendation, { wrap: true }),
      stringCell(row.costSource, { wrap: true }),
      stringCell(row.missingFields, { wrap: true }),
      row.sourceRowNumber,
      stringCell(analysis.formatVersion, { wrap: true }),
    ]),
  ];

  return [
    {
      sheet: "Сводка",
      data: summary,
      columns: [{ width: 28 }, { width: 24 }, { width: 22 }, { width: 42 }],
      stickyRowsCount: 2,
      showGridLines: false,
      zoomScale: 0.9,
    },
    {
      sheet: "SKU",
      data: skuData,
      columns: [
        { width: 11 },
        { width: 23 },
        { width: 28 },
        { width: 18 },
        { width: 16 },
        { width: 14 },
        ...Array.from({ length: 14 }, () => ({ width: 18 })),
        { width: 30 },
        { width: 52 },
        { width: 28 },
        { width: 30 },
        { width: 18 },
        { width: 32 },
      ],
      stickyRowsCount: 1,
      stickyColumnsCount: 4,
      showGridLines: false,
      orientation: "landscape",
      zoomScale: 0.75,
    },
  ];
}

export function createReportExportFileName(
  sourceFileName: string,
  extension: "csv" | "xlsx",
): string {
  const baseName = sourceFileName.replace(/\.[^.]+$/, "");
  const safeBaseName = baseName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);

  return `profit-doctor-${safeBaseName || "report"}.${extension}`;
}
