"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  analyzeParsedReport,
  type ReportAnalysis,
} from "@/domain/reports/analyze-report";
import { parseRublesToKopecks } from "@/domain/reports/decimal";
import type { ParsedReport } from "@/domain/reports/parser";
import {
  parseWildberriesApiPreviewWorkbook,
  ReportParseError,
} from "@/domain/reports/wildberries-api-preview";
import { validateReportFile } from "@/domain/reports/validate-upload";

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

type CostEditorProps = {
  report: ParsedReport;
  values: Readonly<Record<string, string>>;
  errors: Readonly<Record<string, string>>;
  formError: string;
  appliedCosts: Readonly<Record<string, number>>;
  onChange: (sku: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CostEditor({
  report,
  values,
  errors,
  formError,
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
      </form>
    </section>
  );
}

function SourceBreakdown({ row }: { row: ReportAnalysis["rows"][number] }) {
  const sourceRows = [
    ["Выручка", row.profit.revenueKopecks, "retail_amount"],
    [
      "Комиссия WB",
      row.marketplaceCommissionKopecks,
      "retail_amount − ppvz_for_pay",
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

function MobileAnalysisCards({ analysis }: { analysis: ReportAnalysis }) {
  return (
    <div className="analysis-mobile-list">
      {analysis.rows.map((row) => (
        <article className="analysis-mobile-card" key={row.sku}>
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
              <dt>Удержания WB</dt>
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
          <SourceBreakdown row={row} />
        </article>
      ))}
    </div>
  );
}

function AnalysisResult({
  analysis,
  calculationMessage,
}: {
  analysis: ReportAnalysis;
  calculationMessage: string;
}) {
  return (
    <section className="analysis-result" aria-labelledby="analysis-title">
      <div className="analysis-heading">
        <div>
          <p className="eyebrow eyebrow-dark">Результат проверки</p>
          <h2 id="analysis-title">Отчёт WB прочитан и сверен</h2>
        </div>
        <span className="analysis-badge">Локально</span>
      </div>

      {calculationMessage && (
        <p className="analysis-calculation-status" role="status">
          <strong>Готово.</strong> {calculationMessage}
        </p>
      )}

      <p className="analysis-notice">
        Результат учитывает удержания WB и введённую себестоимость. Рекламы в
        этом отчёте нет, поэтому положительная сумма — ещё не чистая прибыль.
      </p>

      <dl className="analysis-summary" data-testid="analysis-summary">
        <div>
          <dt>Выручка</dt>
          <dd>{formatKopecks(analysis.totalRevenueKopecks)}</dd>
        </div>
        <div>
          <dt>Удержания WB</dt>
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

      <div className="analysis-table-wrap analysis-table-desktop">
        <table className="analysis-table">
          <caption className="visually-hidden">
            Оценка результата по товарам Wildberries
          </caption>
          <thead>
            <tr>
              <th scope="col">Товар</th>
              <th scope="col">Количество</th>
              <th scope="col">Выручка</th>
              <th scope="col">Удержания WB</th>
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
                  <SourceBreakdown row={row} />
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
      <MobileAnalysisCards analysis={analysis} />
    </section>
  );
}

export function ReportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const analysisRunRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"CSV" | "XLSX" | null>(null);
  const [error, setError] = useState("");
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
    if (!file || format !== "XLSX") {
      return;
    }

    setIsAnalyzing(true);
    resetAnalysis();
    setError("");

    const runId = ++analysisRunRef.current;

    try {
      const parsed = await parseWildberriesApiPreviewWorkbook(file);
      if (analysisRunRef.current === runId) {
        setReport(parsed);
      }
    } catch (cause) {
      if (analysisRunRef.current === runId) {
        setError(
          cause instanceof ReportParseError
            ? cause.message
            : "Не удалось обработать отчёт. Файл не был отправлен на сервер",
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
        <span>WB XLSX, максимум 10 МБ</span>
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
        Поддерживаются файлы CSV и XLSX размером до 10 мегабайт. Первый
        анализатор работает с XLSX финансового отчёта Wildberries.
      </p>
      <div id="upload-status" aria-live="polite">
        {error && (
          <p className="upload-message upload-error">
            <strong>Отчёт не обработан</strong>
            {error}
          </p>
        )}
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
            Первый адаптер разбирает XLSX с полями финансового отчёта WB. CSV
            можно выбрать, но его анализ появится после фиксации формата.
          </p>
        )}
      </div>

      <button
        className="button button-primary upload-submit"
        type="button"
        disabled={!file || format !== "XLSX" || isAnalyzing}
        onClick={handleAnalyze}
      >
        {isAnalyzing ? "Сверяем операции…" : "Проверить отчёт локально"}
      </button>
      <p className="upload-privacy">
        <span aria-hidden="true">●</span>
        Анализ выполняется в этом браузере. Файл не отправляется и не хранится
        на сервере
      </p>

      {report && (
        <CostEditor
          report={report}
          values={costValues}
          errors={costErrors}
          formError={costFormError}
          appliedCosts={appliedUnitCosts}
          onChange={handleCostChange}
          onSubmit={handleCostSubmit}
        />
      )}
      {analysis && (
        <div>
          <AnalysisResult
            analysis={analysis}
            calculationMessage={calculationMessage}
          />
        </div>
      )}
    </div>
  );
}
