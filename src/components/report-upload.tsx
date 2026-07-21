"use client";

import { readSheet } from "read-excel-file/universal";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  analyzeParsedReport,
  type ReportAnalysis,
} from "@/domain/reports/analyze-report";
import { parseRublesToKopecks } from "@/domain/reports/decimal";
import {
  diagnoseReport,
  type ExpenseDriver,
  type SkuDiagnosis,
} from "@/domain/reports/diagnose-report";
import { parseCsvRows } from "@/domain/reports/csv";
import {
  OZON_CSV_DEMO_REPORT,
  PUBLIC_DEMO_TEMPLATE_LINKS,
  WB_CSV_DEMO_REPORT,
  WB_XLSX_DEMO_REPORT,
  WORKING_DEMO_TEMPLATE_LINKS,
} from "@/domain/reports/demo-fixtures";
import { detectReportMarketplace } from "@/domain/reports/detect-marketplace";
import {
  parseOzonFinanceCsvText,
  OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
  OZON_FINANCE_CSV_REQUIRED_HEADERS,
} from "@/domain/reports/ozon-finance-csv-preview";
import type { ParsedReport } from "@/domain/reports/parser";
import {
  parseWildberriesFinanceCsvText,
  WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION,
  WB_FINANCE_CSV_REQUIRED_HEADERS,
} from "@/domain/reports/wildberries-finance-csv-preview";
import {
  parseWildberriesApiPreviewWorkbook,
  ReportParseError,
  WB_API_PREVIEW_FORMAT_VERSION,
  WB_API_PREVIEW_REQUIRED_HEADERS,
} from "@/domain/reports/wildberries-api-preview";
import { validateReportFile } from "@/domain/reports/validate-upload";
import { ReportExportActions } from "./report-export-actions";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

function formatKopecks(value: number): string {
  const amount = BigInt(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const rubles = (absolute / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const kopecks = (absolute % 100n).toString().padStart(2, "0");

  return `${negative ? "−" : ""}${rubles}${kopecks === "00" ? "" : `,${kopecks}`} ₽`;
}

function marketplaceShortName(marketplace: ParsedReport["marketplace"]) {
  return marketplace === "wildberries" ? "WB" : "Ozon";
}

function adapterDisplayName(report: ParsedReport): string {
  if (report.formatVersion === WB_API_PREVIEW_FORMAT_VERSION) {
    return "WB XLSX API preview";
  }

  if (report.formatVersion === WB_FINANCE_CSV_PREVIEW_FORMAT_VERSION) {
    return "WB CSV finance preview";
  }

  if (report.formatVersion === OZON_FINANCE_CSV_PREVIEW_FORMAT_VERSION) {
    return "Ozon CSV finance preview";
  }

  return "Preview-адаптер";
}

type UploadDiagnostic = {
  title: string;
  summary: string;
  foundColumns: string[];
  missingColumns: string[];
  templateLinks: readonly { href: string; label: string }[];
};

type RawSheetCell = string | number | boolean | Date | null;

function normalizeDiagnosticHeader(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function decodeNumericHtmlEntities(value: string): string {
  return value.replace(/&#(\d+);/g, (_, code: string) =>
    String.fromCodePoint(Number(code)),
  );
}

function toDiagnosticCell(cell: RawSheetCell | undefined): string {
  if (cell === null || cell === undefined) {
    return "";
  }

  if (cell instanceof Date) {
    return cell.toISOString();
  }

  return decodeNumericHtmlEntities(String(cell)).trim();
}

function chooseLikelyHeaderRow(
  rows: readonly (readonly RawSheetCell[])[],
): string[] {
  const candidates = rows.slice(0, 20).map((row) => {
    const cells = row.map(toDiagnosticCell).filter(Boolean);
    const normalized = new Set(cells.map(normalizeDiagnosticHeader));
    const markerScore = [
      "nm_id",
      "barcode",
      "doc_type_name",
      "supplier_oper_name",
      "ppvz_for_pay",
      "sku",
      "offer_id",
      "тип начисления",
    ].filter((marker) => normalized.has(marker)).length;

    return { cells, markerScore };
  });

  return (
    candidates.sort(
      (left, right) =>
        right.markerScore - left.markerScore ||
        right.cells.length - left.cells.length,
    )[0]?.cells ?? []
  );
}

function missingHeaders(
  required: readonly string[],
  foundColumns: readonly string[],
): string[] {
  const found = new Set(foundColumns.map(normalizeDiagnosticHeader));

  return required.filter(
    (header) => !found.has(normalizeDiagnosticHeader(header)),
  );
}

function diagnosticTitle(cause: unknown): string {
  if (!(cause instanceof ReportParseError)) {
    return "Формат пока не поддерживается";
  }

  if (cause.code === "MISSING_COLUMNS") {
    return "Не хватает колонок для расчёта";
  }

  if (cause.code === "WB_PRODUCT_CATALOG_UPLOADED") {
    return "Это товарный каталог, не финансовый отчёт";
  }

  if (cause.code.includes("FORMAT_NOT_RECOGNIZED")) {
    return "Формат пока не поддерживается";
  }

  return "Отчёт требует проверки";
}

function buildDiagnosticFromColumns(
  format: "CSV" | "XLSX",
  foundColumns: string[],
  cause: unknown,
): UploadDiagnostic {
  const marketplace = detectReportMarketplace(foundColumns);
  const required =
    format === "XLSX"
      ? WB_API_PREVIEW_REQUIRED_HEADERS
      : marketplace === "ozon"
        ? OZON_FINANCE_CSV_REQUIRED_HEADERS
        : WB_FINANCE_CSV_REQUIRED_HEADERS;
  const foundPreview = foundColumns.slice(0, 12);
  const missing = missingHeaders(required, foundColumns);

  return {
    title: diagnosticTitle(cause),
    summary:
      marketplace === null
        ? "Мы не нашли достаточно признаков поддерживаемого финансового отчёта WB или Ozon."
        : `Файл похож на ${marketplaceShortName(marketplace)}, но preview-адаптеру не хватает данных для безопасного расчёта.`,
    foundColumns: foundPreview,
    missingColumns:
      missing.length > 0
        ? missing
        : ["Поддерживаемая строка заголовков финансового отчёта"],
    templateLinks: WORKING_DEMO_TEMPLATE_LINKS,
  };
}

async function buildUploadDiagnostic(
  file: File,
  format: "CSV" | "XLSX",
  cause: unknown,
): Promise<UploadDiagnostic> {
  try {
    if (format === "CSV") {
      const rows = parseCsvRows(await file.text());
      return buildDiagnosticFromColumns(
        format,
        chooseLikelyHeaderRow(rows),
        cause,
      );
    }

    const rows = (await readSheet(file)) as RawSheetCell[][];
    return buildDiagnosticFromColumns(
      format,
      chooseLikelyHeaderRow(rows),
      cause,
    );
  } catch {
    return {
      title: diagnosticTitle(cause),
      summary:
        "Не удалось безопасно прочитать заголовки файла. Попробуйте сохранить отчёт заново или сравнить его с демо-шаблоном.",
      foundColumns: [],
      missingColumns: ["Поддерживаемая строка заголовков финансового отчёта"],
      templateLinks: WORKING_DEMO_TEMPLATE_LINKS,
    };
  }
}

async function parseSupportedCsvPreviewFile(file: Blob): Promise<ParsedReport> {
  const text = await file.text();
  const rows = parseCsvRows(text);
  const headers = rows[0] ?? [];
  const marketplace = detectReportMarketplace(headers);

  if (marketplace === "ozon") {
    return parseOzonFinanceCsvText(text);
  }

  if (marketplace === "wildberries") {
    return parseWildberriesFinanceCsvText(text);
  }

  try {
    return parseWildberriesFinanceCsvText(text);
  } catch (wildberriesError) {
    try {
      return parseOzonFinanceCsvText(text);
    } catch {
      throw wildberriesError;
    }
  }
}

type CostEditorProps = {
  report: ParsedReport;
  values: Readonly<Record<string, string>>;
  errors: Readonly<Record<string, string>>;
  formError: string;
  calculationMessage: string;
  appliedCosts: Readonly<Record<string, number>>;
  onChange: (sku: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ImportAdapterStatus({
  isAnalyzing,
  report,
}: {
  isAnalyzing: boolean;
  report: ParsedReport | null;
}) {
  if (isAnalyzing) {
    return (
      <section
        className="import-adapter-status import-adapter-status-pending"
        aria-label="Статус определения адаптера отчёта"
      >
        <span>Определяем адаптер</span>
        <strong>Проверяем заголовки и структуру файла</strong>
        <p>Файл остаётся в браузере; на сервер ничего не отправляется.</p>
      </section>
    );
  }

  if (!report) {
    return null;
  }

  const marketplaceName = marketplaceShortName(report.marketplace);

  return (
    <section
      className="import-adapter-status"
      aria-label="Распознанный адаптер отчёта"
      data-testid="import-adapter-status"
    >
      <span>Распознан адаптер</span>
      <strong>
        {marketplaceName} · {adapterDisplayName(report)}
      </strong>
      <p>
        Версия: <code>{report.formatVersion}</code>
      </p>
    </section>
  );
}

function UploadDiagnosticCard({
  diagnostic,
}: {
  diagnostic: UploadDiagnostic;
}) {
  return (
    <section
      className="upload-diagnostic"
      aria-labelledby="upload-diagnostic-title"
    >
      <div>
        <p className="eyebrow eyebrow-dark">Диагностика формата</p>
        <h2 id="upload-diagnostic-title">{diagnostic.title}</h2>
        <p>{diagnostic.summary}</p>
      </div>

      <div className="upload-diagnostic-grid">
        <div>
          <strong>Нашли в файле</strong>
          {diagnostic.foundColumns.length > 0 ? (
            <ul>
              {diagnostic.foundColumns.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          ) : (
            <p>Заголовки не удалось прочитать безопасно.</p>
          )}
        </div>
        <div>
          <strong>Не хватает для preview</strong>
          <ul>
            {diagnostic.missingColumns.map((column) => (
              <li key={column}>{column}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="upload-diagnostic-actions">
        <span>Сравните файл с шаблоном:</span>
        {diagnostic.templateLinks.map((link) => (
          <a href={link.href} key={link.href} download>
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function CostEditor({
  report,
  values,
  errors,
  formError,
  calculationMessage,
  appliedCosts,
  onChange,
  onSubmit,
}: CostEditorProps) {
  const rows = report.rows.filter((row) => row.quantity > 0);
  const appliedCount = rows.filter((row) =>
    Object.prototype.hasOwnProperty.call(appliedCosts, row.sku),
  ).length;

  return (
    <section className="cost-editor" aria-labelledby="cost-editor-title">
      <div className="cost-editor-heading">
        <div>
          <p className="eyebrow eyebrow-dark">Следующий шаг</p>
          <h2 id="cost-editor-title">Добавьте себестоимость товаров</h2>
        </div>
        <span>
          {appliedCount} из {rows.length} SKU
        </span>
      </div>
      <p>
        Укажите закупочную себестоимость одной единицы. Мы умножим её на
        количество из отчёта и пересчитаем результат до рекламы.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <div className="cost-grid">
          {rows.map((row, index) => {
            const errorId = `cost-error-${index}`;
            const label = `Себестоимость одной единицы для ${row.productName ?? row.sku}, ₽`;

            return (
              <label className="cost-field" key={row.sku}>
                <span className="cost-product">
                  <strong>{row.productName ?? row.sku}</strong>
                  <small>
                    {row.sku} · {row.quantity} шт.
                  </small>
                </span>
                <span className="cost-label">Себестоимость единицы, ₽</span>
                <input
                  aria-label={label}
                  aria-describedby={errors[row.sku] ? errorId : undefined}
                  aria-invalid={Boolean(errors[row.sku])}
                  autoComplete="off"
                  inputMode="decimal"
                  maxLength={14}
                  placeholder="Например, 850,50"
                  type="text"
                  value={values[row.sku] ?? ""}
                  onChange={(event) => onChange(row.sku, event.target.value)}
                />
                {errors[row.sku] && (
                  <small className="cost-error" id={errorId}>
                    {errors[row.sku]}
                  </small>
                )}
              </label>
            );
          })}
        </div>
        <button className="button button-primary cost-submit" type="submit">
          Пересчитать прибыль
        </button>
        {formError && (
          <p className="cost-form-error" role="alert">
            {formError}
          </p>
        )}
        {calculationMessage && !formError && (
          <p className="cost-form-success" role="status">
            <span>
              <strong>Готово.</strong> {calculationMessage}
            </span>
            <a href="#analysis-title">Показать результат ↓</a>
          </p>
        )}
      </form>
    </section>
  );
}

function SourceBreakdown({
  row,
  marketplaceName,
}: {
  row: ReportAnalysis["rows"][number];
  marketplaceName: string;
}) {
  const sourceRows = [
    ["Выручка", row.profit.revenueKopecks, "retail_amount"],
    [
      `Комиссия ${marketplaceName}`,
      row.marketplaceCommissionKopecks,
      marketplaceName === "WB"
        ? "retail_amount − ppvz_for_pay"
        : "Комиссия за продажу",
    ],
    ["Логистика", row.logisticsKopecks, "delivery_rub"],
    ["Хранение", row.storageKopecks, "storage_fee"],
    ["Возвраты", row.returnsKopecks, "retail_amount возврата"],
    ["Штрафы", row.penaltiesKopecks, "penalty"],
    ["Другие удержания", row.otherExpensesKopecks, "deduction"],
  ] as const;

  const costSource =
    row.costOfGoodsSource === "user-unit-cost"
      ? `${formatKopecks(row.unitCostKopecks ?? 0)} × ${row.quantity} шт.`
      : row.costOfGoodsSource === "report"
        ? "Поле исходного отчёта"
        : "Не указана";

  return (
    <details className="source-breakdown">
      <summary>Откуда суммы</summary>
      <dl>
        {sourceRows.map(([label, value, source]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value === null ? "Нет данных" : formatKopecks(value)}
              <small>{source}</small>
            </dd>
          </div>
        ))}
        <div>
          <dt>Себестоимость</dt>
          <dd>
            {row.profit.costOfGoodsKopecks === null
              ? "Не указана"
              : formatKopecks(row.profit.costOfGoodsKopecks)}
            <small>{costSource}</small>
          </dd>
        </div>
        <div>
          <dt>Реклама</dt>
          <dd>
            Нет данных<small>Не найдена в этом отчёте</small>
          </dd>
        </div>
      </dl>
    </details>
  );
}

function AnalysisStatus({ row }: { row: ReportAnalysis["rows"][number] }) {
  const status = row.profit.isLoss
    ? {
        className: "analysis-status-loss",
        label: "Убыток",
      }
    : row.costOfGoodsSource === "missing"
      ? {
          className: "analysis-status-missing",
          label: "Нужна себестоимость",
        }
      : {
          className: "analysis-status-positive",
          label: "Пока в плюсе",
        };

  return (
    <span className={`analysis-status ${status.className}`}>
      {status.label}
    </span>
  );
}

function MobileAnalysisCards({
  analysis,
  marketplaceName,
}: {
  analysis: ReportAnalysis;
  marketplaceName: string;
}) {
  return (
    <div className="analysis-mobile-list" data-testid="analysis-mobile-list">
      {analysis.rows.map((row) => (
        <article
          className="analysis-mobile-card"
          data-testid="analysis-mobile-card"
          key={row.sku}
        >
          <div className="analysis-mobile-heading">
            <div>
              <h3>{row.productName ?? row.sku}</h3>
              <p>{row.sku}</p>
            </div>
            <AnalysisStatus row={row} />
          </div>
          <dl className="analysis-mobile-values">
            <div>
              <dt>Количество</dt>
              <dd>{row.quantity} шт.</dd>
            </div>
            <div>
              <dt>Выручка</dt>
              <dd>{formatKopecks(row.profit.revenueKopecks)}</dd>
            </div>
            <div>
              <dt>Удержания {marketplaceName}</dt>
              <dd>{formatKopecks(row.profit.marketplaceExpensesKopecks)}</dd>
            </div>
            <div>
              <dt>Себестоимость</dt>
              <dd>
                {row.profit.costOfGoodsKopecks === null
                  ? "Не указана"
                  : formatKopecks(row.profit.costOfGoodsKopecks)}
              </dd>
            </div>
            <div className="analysis-mobile-result">
              <dt>Результат до рекламы</dt>
              <dd className={row.profit.isLoss ? "analysis-loss" : undefined}>
                {formatKopecks(row.profit.operatingProfitKopecks)}
              </dd>
            </div>
          </dl>
          <SourceBreakdown row={row} marketplaceName={marketplaceName} />
        </article>
      ))}
    </div>
  );
}

const EXPENSE_DRIVER_LABELS: Record<ExpenseDriver, string> = {
  "cost-of-goods": "себестоимость",
  commission: "комиссия WB",
  logistics: "логистика",
  storage: "хранение",
  returns: "возвраты",
  penalties: "штрафы",
  advertising: "реклама",
  other: "прочие удержания",
};

const EXPENSE_DRIVER_ACTIONS: Record<ExpenseDriver, string> = {
  "cost-of-goods":
    "Сначала проверьте закупочную цену, комплектацию и фактическую себестоимость.",
  commission:
    "Сначала проверьте категорию товара и ставку комиссии в кабинете WB.",
  logistics:
    "Сначала проверьте габариты, упаковку и схему поставки — они влияют на логистику.",
  storage:
    "Сначала проверьте оборачиваемость и остатки, которые увеличивают хранение.",
  returns:
    "Сначала проверьте причины возвратов, карточку товара и качество комплектации.",
  penalties: "Сначала разберите штрафы и устраните повторяющиеся причины.",
  advertising:
    "Сначала проверьте кампании и отключите расходы без подтверждённых продаж.",
  other:
    "Сначала раскройте прочие удержания в отчёте и проверьте их назначение.",
};

function diagnosisText(diagnosis: SkuDiagnosis): string {
  if (diagnosis.status === "missing-cost") {
    return "Добавьте себестоимость — без неё нельзя определить запас до безубыточности.";
  }

  if (diagnosis.status === "loss") {
    return diagnosis.lossBeforeCostOfGoods
      ? "Удержания маркетплейса уже выше выручки. Даже нулевая себестоимость не выводит товар в плюс."
      : `Порог себестоимости до рекламы — ${formatKopecks(
          diagnosis.maxAffordableCostOfGoodsKopecks,
        )} за период${
          diagnosis.maxAffordableUnitCostKopecks === null
            ? ""
            : `, или ${formatKopecks(
                diagnosis.maxAffordableUnitCostKopecks,
              )} за единицу`
        }.`;
  }

  return diagnosis.status === "positive-estimate"
    ? `Запас по известным расходам — ${formatKopecks(
        diagnosis.positiveBufferKopecks,
      )}. Если реклама и другие пропущенные расходы выше этой суммы, SKU станет убыточным.`
    : `Запас до нулевого результата — ${formatKopecks(
        diagnosis.positiveBufferKopecks,
      )}.`;
}

function DiagnosisPanel({ analysis }: { analysis: ReportAnalysis }) {
  const diagnosis = diagnoseReport(analysis);

  if (
    analysis.missingCostSkuCount === analysis.skuCount &&
    diagnosis.lossSkuCount === 0
  ) {
    return null;
  }

  const rowsBySku = new Map(analysis.rows.map((row) => [row.sku, row]));
  const orderedRows = [...diagnosis.rows].sort((left, right) => {
    const leftPriority = diagnosis.prioritySkus.indexOf(left.sku);
    const rightPriority = diagnosis.prioritySkus.indexOf(right.sku);

    if (leftPriority >= 0 || rightPriority >= 0) {
      if (leftPriority < 0) return 1;
      if (rightPriority < 0) return -1;
      return leftPriority - rightPriority;
    }

    return right.positiveBufferKopecks - left.positiveBufferKopecks;
  });
  const primaryRow = diagnosis.primaryLossSku
    ? rowsBySku.get(diagnosis.primaryLossSku)
    : null;

  return (
    <section
      className="profit-diagnosis"
      aria-labelledby="profit-diagnosis-title"
      data-testid="profit-diagnosis"
    >
      <div className="profit-diagnosis-heading">
        <div>
          <p className="eyebrow">Диагноз Profit Doctor</p>
          <h3 id="profit-diagnosis-title">
            {diagnosis.lossSkuCount > 0
              ? "С чего начать восстановление прибыли"
              : "Что контролировать дальше"}
          </h3>
        </div>
        <span>До рекламы</span>
      </div>

      <p className="profit-diagnosis-lead">
        {diagnosis.lossSkuCount > 0
          ? `Проблемные SKU дают ${formatKopecks(
              diagnosis.totalLossKopecks,
            )} убытка за период. Таких товаров — ${diagnosis.lossSkuCount}. Это сумма их убытков, а не итог после взаимозачёта с прибыльными.`
          : "По известным расходам убыточных SKU нет. Положительный результат ещё нужно сверить с рекламой и другими расходами вне отчёта."}
      </p>

      <dl className="profit-diagnosis-summary">
        <div>
          <dt>Убыток проблемных SKU</dt>
          <dd>{formatKopecks(diagnosis.totalLossKopecks)}</dd>
        </div>
        <div>
          <dt>Запас SKU в плюсе</dt>
          <dd>{formatKopecks(diagnosis.totalPositiveBufferKopecks)}</dd>
        </div>
        <div>
          <dt>Первый приоритет</dt>
          <dd>
            {primaryRow?.productName ?? primaryRow?.sku ?? "Сверить рекламу"}
          </dd>
        </div>
      </dl>

      <div className="profit-diagnosis-list">
        {orderedRows.map((rowDiagnosis) => {
          const row = rowsBySku.get(rowDiagnosis.sku);
          const priorityIndex = diagnosis.prioritySkus.indexOf(
            rowDiagnosis.sku,
          );
          const driver = rowDiagnosis.largestKnownExpense;

          return (
            <article
              className={`profit-diagnosis-card profit-diagnosis-${rowDiagnosis.status}`}
              key={rowDiagnosis.sku}
            >
              <div className="profit-diagnosis-card-heading">
                <div>
                  <span>
                    {priorityIndex >= 0
                      ? `Приоритет ${priorityIndex + 1}`
                      : rowDiagnosis.status === "missing-cost"
                        ? "Нужны данные"
                        : "Контроль"}
                  </span>
                  <h4>{row?.productName ?? rowDiagnosis.sku}</h4>
                  <small>{rowDiagnosis.sku}</small>
                </div>
                <strong>
                  {rowDiagnosis.status === "loss"
                    ? `−${formatKopecks(rowDiagnosis.breakEvenGapKopecks)}`
                    : rowDiagnosis.status === "missing-cost"
                      ? "—"
                      : formatKopecks(rowDiagnosis.positiveBufferKopecks)}
                </strong>
              </div>

              <p>{diagnosisText(rowDiagnosis)}</p>

              {rowDiagnosis.status === "loss" && (
                <p className="profit-diagnosis-action">
                  Улучшите результат минимум на{" "}
                  <strong>
                    {formatKopecks(rowDiagnosis.breakEvenGapKopecks)}
                  </strong>{" "}
                  за период — за счёт выручки после удержаний и/или снижения
                  расходов.
                </p>
              )}

              {driver && (
                <div className="profit-diagnosis-driver">
                  <span>
                    Крупнейшая известная статья —{" "}
                    <strong>{EXPENSE_DRIVER_LABELS[driver.driver]}</strong>:{" "}
                    {formatKopecks(driver.amountKopecks)}
                  </span>
                  {rowDiagnosis.status === "loss" && (
                    <small>{EXPENSE_DRIVER_ACTIONS[driver.driver]}</small>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AnalysisResult({
  analysis,
  sourceFileName,
}: {
  analysis: ReportAnalysis;
  sourceFileName: string;
}) {
  const marketplaceName = marketplaceShortName(analysis.marketplace);

  return (
    <section className="analysis-result" aria-labelledby="analysis-title">
      <div className="analysis-heading">
        <div>
          <p className="eyebrow eyebrow-dark">Результат проверки</p>
          <h2 id="analysis-title">Отчёт {marketplaceName} прочитан локально</h2>
        </div>
        <span className="analysis-badge">Локально</span>
      </div>

      <p className="analysis-notice">
        Результат учитывает удержания {marketplaceName} и введённую
        себестоимость. Рекламы в этом отчёте нет, поэтому положительная сумма —
        ещё не чистая прибыль.
      </p>

      <dl className="analysis-summary" data-testid="analysis-summary">
        <div>
          <dt>Выручка</dt>
          <dd>{formatKopecks(analysis.totalRevenueKopecks)}</dd>
        </div>
        <div>
          <dt>Удержания {marketplaceName}</dt>
          <dd>{formatKopecks(analysis.totalKnownExpensesKopecks)}</dd>
        </div>
        <div>
          <dt>Себестоимость</dt>
          <dd>{formatKopecks(analysis.totalKnownCostOfGoodsKopecks)}</dd>
        </div>
        <div className="analysis-summary-accent">
          <dt>Результат до рекламы</dt>
          <dd>{formatKopecks(analysis.estimatedProfitKopecks)}</dd>
        </div>
      </dl>

      <div className="analysis-meta">
        <span>{analysis.sourceRowCount} операций</span>
        <span>{analysis.skuCount} SKU</span>
        <span>
          {analysis.missingCostSkuCount > 0
            ? `Нужна себестоимость для ${analysis.missingCostSkuCount} SKU`
            : "Себестоимость заполнена для всех SKU"}
        </span>
        <span>
          {analysis.lossSkuCount > 0
            ? `${analysis.lossSkuCount} убыточных SKU`
            : "Убыточных SKU по известным расходам нет"}
        </span>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="analysis-warnings">
          <strong>Проверьте предупреждения</strong>
          <ul>
            {analysis.warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.sourceRowNumber ?? index}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DiagnosisPanel analysis={analysis} />

      <ReportExportActions
        analysis={analysis}
        sourceFileName={sourceFileName}
      />

      <div className="analysis-table-wrap analysis-table-desktop">
        <table className="analysis-table">
          <caption className="visually-hidden">
            Оценка результата по товарам {marketplaceName}
          </caption>
          <thead>
            <tr>
              <th scope="col">Товар</th>
              <th scope="col">Количество</th>
              <th scope="col">Выручка</th>
              <th scope="col">Удержания {marketplaceName}</th>
              <th scope="col">Себестоимость</th>
              <th scope="col">Результат</th>
            </tr>
          </thead>
          <tbody>
            {analysis.rows.map((row) => (
              <tr key={row.sku}>
                <th scope="row">
                  <strong>{row.productName ?? row.sku}</strong>
                  <span>{row.sku}</span>
                  <SourceBreakdown
                    row={row}
                    marketplaceName={marketplaceName}
                  />
                </th>
                <td>{row.quantity} шт.</td>
                <td>{formatKopecks(row.profit.revenueKopecks)}</td>
                <td>{formatKopecks(row.profit.marketplaceExpensesKopecks)}</td>
                <td>
                  {row.profit.costOfGoodsKopecks === null
                    ? "Не указана"
                    : formatKopecks(row.profit.costOfGoodsKopecks)}
                </td>
                <td>
                  <strong
                    className={row.profit.isLoss ? "analysis-loss" : undefined}
                  >
                    {formatKopecks(row.profit.operatingProfitKopecks)}
                  </strong>
                  <AnalysisStatus row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MobileAnalysisCards
        analysis={analysis}
        marketplaceName={marketplaceName}
      />
    </section>
  );
}

export function ReportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const analysisRunRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"CSV" | "XLSX" | null>(null);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState<UploadDiagnostic | null>(null);
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [costValues, setCostValues] = useState<Record<string, string>>({});
  const [costErrors, setCostErrors] = useState<Record<string, string>>({});
  const [costFormError, setCostFormError] = useState("");
  const [calculationMessage, setCalculationMessage] = useState("");
  const [appliedUnitCosts, setAppliedUnitCosts] = useState<
    Record<string, number>
  >({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysis = useMemo(
    () => (report ? analyzeParsedReport(report, appliedUnitCosts) : null),
    [appliedUnitCosts, report],
  );

  function resetAnalysis() {
    setReport(null);
    setDiagnostic(null);
    setCostValues({});
    setCostErrors({});
    setCostFormError("");
    setCalculationMessage("");
    setAppliedUnitCosts({});
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    analysisRunRef.current += 1;
    setIsAnalyzing(false);

    const result = validateReportFile(selectedFile);
    if (!result.ok) {
      setFile(null);
      setFormat(null);
      resetAnalysis();
      setError(result.message);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setFormat(result.format);
    resetAnalysis();
    setError("");
  }

  function clearSelection() {
    analysisRunRef.current += 1;
    setFile(null);
    setFormat(null);
    resetAnalysis();
    setIsAnalyzing(false);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  async function handleAnalyze() {
    if (!file || !format) {
      return;
    }

    setIsAnalyzing(true);
    resetAnalysis();
    setError("");

    const runId = ++analysisRunRef.current;

    try {
      const parsed =
        format === "XLSX"
          ? await parseWildberriesApiPreviewWorkbook(file)
          : await parseSupportedCsvPreviewFile(file);
      if (analysisRunRef.current === runId) {
        setReport(parsed);
        setDiagnostic(null);
      }
    } catch (cause) {
      if (analysisRunRef.current === runId) {
        setError(
          cause instanceof ReportParseError
            ? cause.message
            : "Не удалось обработать отчёт. Файл не был отправлен на сервер",
        );
        setDiagnostic(await buildUploadDiagnostic(file, format, cause));
      }
    } finally {
      if (analysisRunRef.current === runId) {
        setIsAnalyzing(false);
      }
    }
  }

  async function handleLoadDemoReport() {
    const runId = ++analysisRunRef.current;

    setFile(null);
    setFormat(null);
    resetAnalysis();
    setError("");
    setIsAnalyzing(true);

    try {
      const response = await fetch(WB_XLSX_DEMO_REPORT.href, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("demo report is unavailable");
      }

      const buffer = await response.arrayBuffer();
      const demoFile = new File(
        [new Uint8Array(buffer)],
        WB_XLSX_DEMO_REPORT.downloadName,
        {
          type: WB_XLSX_DEMO_REPORT.mimeType,
        },
      );
      const parsed = await parseWildberriesApiPreviewWorkbook(demoFile);

      if (analysisRunRef.current === runId) {
        setFile(demoFile);
        setFormat("XLSX");
        setReport(parsed);
        setDiagnostic(null);
      }
    } catch {
      if (analysisRunRef.current === runId) {
        setError(
          "Не удалось открыть демо-отчёт. Попробуйте выбрать XLSX вручную.",
        );
      }
    } finally {
      if (analysisRunRef.current === runId) {
        setIsAnalyzing(false);
      }
    }
  }

  async function handleLoadDemoCsvReport() {
    const runId = ++analysisRunRef.current;

    setFile(null);
    setFormat(null);
    resetAnalysis();
    setError("");
    setIsAnalyzing(true);

    try {
      const response = await fetch(WB_CSV_DEMO_REPORT.href, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("demo csv report is unavailable");
      }

      const text = await response.text();
      const demoFile = new File([text], WB_CSV_DEMO_REPORT.downloadName, {
        type: WB_CSV_DEMO_REPORT.mimeType,
      });
      const parsed = parseWildberriesFinanceCsvText(text);

      if (analysisRunRef.current === runId) {
        setFile(demoFile);
        setFormat("CSV");
        setReport(parsed);
        setDiagnostic(null);
      }
    } catch {
      if (analysisRunRef.current === runId) {
        setError(
          "Не удалось открыть демо CSV. Попробуйте скачать шаблон и выбрать его вручную.",
        );
      }
    } finally {
      if (analysisRunRef.current === runId) {
        setIsAnalyzing(false);
      }
    }
  }

  async function handleLoadDemoOzonCsvReport() {
    const runId = ++analysisRunRef.current;

    setFile(null);
    setFormat(null);
    resetAnalysis();
    setError("");
    setIsAnalyzing(true);

    try {
      const response = await fetch(OZON_CSV_DEMO_REPORT.href, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("demo ozon csv report is unavailable");
      }

      const text = await response.text();
      const demoFile = new File([text], OZON_CSV_DEMO_REPORT.downloadName, {
        type: OZON_CSV_DEMO_REPORT.mimeType,
      });
      const parsed = parseOzonFinanceCsvText(text);

      if (analysisRunRef.current === runId) {
        setFile(demoFile);
        setFormat("CSV");
        setReport(parsed);
        setDiagnostic(null);
      }
    } catch {
      if (analysisRunRef.current === runId) {
        setError(
          "Не удалось открыть демо CSV Ozon. Попробуйте скачать шаблон и выбрать его вручную.",
        );
      }
    } finally {
      if (analysisRunRef.current === runId) {
        setIsAnalyzing(false);
      }
    }
  }

  function handleCostChange(sku: string, value: string) {
    setCostValues((current) => ({ ...current, [sku]: value }));
    setCostFormError("");
    setCalculationMessage("");
    setCostErrors((current) => {
      if (!current[sku]) {
        return current;
      }

      const next = { ...current };
      delete next[sku];
      return next;
    });
  }

  function handleCostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!report) {
      return;
    }

    const nextCosts: Record<string, number> = {};
    const nextErrors: Record<string, string> = {};

    for (const row of report.rows) {
      if (row.quantity <= 0) {
        continue;
      }

      const value = costValues[row.sku]?.trim() ?? "";
      if (!value) {
        continue;
      }

      try {
        const cost = parseRublesToKopecks(value, `unitCost:${row.sku}`);
        if (cost < 0) {
          throw new RangeError("negative cost");
        }
        nextCosts[row.sku] = cost;
      } catch {
        nextErrors[row.sku] =
          "Введите неотрицательную сумму: например, 850 или 850,50";
      }
    }

    setCostErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCostFormError("Исправьте отмеченные суммы и повторите пересчёт.");
      return;
    }

    const completedCount = Object.keys(nextCosts).length;
    if (completedCount === 0) {
      setCostFormError("Введите себестоимость хотя бы для одного SKU.");
      return;
    }

    setCostFormError("");
    setAppliedUnitCosts(nextCosts);
    setCalculationMessage(
      `Себестоимость учтена для ${completedCount} из ${report.rows.filter((row) => row.quantity > 0).length} SKU. Результат ниже обновлён.`,
    );
  }

  const dropzoneClassName = [
    "upload-dropzone",
    error ? "upload-dropzone-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="upload-widget">
      <label className={dropzoneClassName} htmlFor="report-file">
        <span className="upload-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path
              d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>
        <strong>
          {file ? "Выбрать другой отчёт" : "Выбрать отчёт с устройства"}
        </strong>
        <span>WB XLSX или CSV WB/Ozon, максимум 10 МБ</span>
        <input
          ref={inputRef}
          id="report-file"
          name="report-file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleChange}
          aria-describedby="upload-limit upload-status"
        />
      </label>

      <p className="visually-hidden" id="upload-limit">
        Поддерживаются файлы CSV и XLSX размером до 10 мегабайт. Анализатор
        работает с XLSX финансового отчёта Wildberries, preview CSV
        API-подобного отчёта WB и synthetic preview CSV Ozon.
      </p>
      <div id="upload-status" aria-live="polite">
        {error && (
          <p className="upload-message upload-error">
            <strong>Отчёт не обработан</strong>
            {error}
          </p>
        )}
        {diagnostic && <UploadDiagnosticCard diagnostic={diagnostic} />}
        {file && format && (
          <div className="selected-file">
            <span className="file-type" aria-hidden="true">
              {format}
            </span>
            <div>
              <strong>{file.name}</strong>
              <span>
                {format} · {formatBytes(file.size)} · расширение и размер
                проверены
              </span>
            </div>
            <button type="button" onClick={clearSelection}>
              Убрать
            </button>
          </div>
        )}
        {file && format === "CSV" && (
          <p className="upload-message upload-format-note">
            CSV будет разобран preview-адаптером WB или Ozon по заголовкам. Если
            в файле есть только сервисные строки без SKU, расчёт остановится с
            объяснением.
          </p>
        )}
      </div>

      <div className="upload-actions">
        <button
          className="button button-primary upload-submit"
          type="button"
          disabled={!file || isAnalyzing}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? "Сверяем операции…" : "Проверить отчёт локально"}
        </button>
        <button
          className="button upload-demo"
          type="button"
          disabled={isAnalyzing}
          onClick={handleLoadDemoReport}
        >
          Открыть демо XLSX WB
        </button>
        <button
          className="button upload-demo"
          type="button"
          disabled={isAnalyzing}
          onClick={handleLoadDemoCsvReport}
        >
          Открыть демо CSV WB
        </button>
        <button
          className="button upload-demo"
          type="button"
          disabled={isAnalyzing}
          onClick={handleLoadDemoOzonCsvReport}
        >
          Открыть демо CSV Ozon
        </button>
      </div>
      <section
        className="demo-templates"
        aria-labelledby="demo-templates-title"
      >
        <div>
          <h2 id="demo-templates-title">Шаблоны для проверки</h2>
          <p>Все файлы синтетические. Можно скачать и загрузить вручную.</p>
        </div>
        <ul>
          {PUBLIC_DEMO_TEMPLATE_LINKS.map((template) => (
            <li key={template.href}>
              <a href={template.href} download>
                {template.description}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <p className="upload-privacy">
        <span aria-hidden="true">●</span>
        Анализ выполняется в этом браузере. Файл не отправляется и не хранится
        на сервере
      </p>

      <ImportAdapterStatus isAnalyzing={isAnalyzing} report={report} />

      {report && (
        <CostEditor
          report={report}
          values={costValues}
          errors={costErrors}
          formError={costFormError}
          calculationMessage={calculationMessage}
          appliedCosts={appliedUnitCosts}
          onChange={handleCostChange}
          onSubmit={handleCostSubmit}
        />
      )}
      {analysis && (
        <div>
          <AnalysisResult
            analysis={analysis}
            sourceFileName={file?.name ?? "report.xlsx"}
          />
        </div>
      )}
    </div>
  );
}
