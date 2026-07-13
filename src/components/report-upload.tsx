"use client";

import { ChangeEvent, useRef, useState } from "react";
import {
  analyzeParsedReport,
  type ReportAnalysis,
} from "@/domain/reports/analyze-report";
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

function AnalysisResult({ analysis }: { analysis: ReportAnalysis }) {
  return (
    <section className="analysis-result" aria-labelledby="analysis-title">
      <div className="analysis-heading">
        <div>
          <p className="eyebrow eyebrow-dark">Результат проверки</p>
          <h2 id="analysis-title">Отчёт WB прочитан и сверен</h2>
        </div>
        <span className="analysis-badge">Локально</span>
      </div>

      <p className="analysis-notice">
        Это оценка до себестоимости и рекламы. Она показывает остаток после
        известных удержаний WB, но пока не является чистой прибылью.
      </p>

      <dl className="analysis-summary">
        <div>
          <dt>Выручка</dt>
          <dd>{formatKopecks(analysis.totalRevenueKopecks)}</dd>
        </div>
        <div>
          <dt>Учтённые расходы</dt>
          <dd>{formatKopecks(analysis.totalKnownExpensesKopecks)}</dd>
        </div>
        <div className="analysis-summary-accent">
          <dt>Оценка остатка</dt>
          <dd>{formatKopecks(analysis.estimatedProfitKopecks)}</dd>
        </div>
      </dl>

      <div className="analysis-meta">
        <span>{analysis.sourceRowCount} операций</span>
        <span>{analysis.skuCount} SKU</span>
        <span>Сумма к выплате сверена до копейки</span>
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

      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <caption className="visually-hidden">
            Оценка результата по товарам Wildberries
          </caption>
          <thead>
            <tr>
              <th scope="col">Товар</th>
              <th scope="col">Выручка</th>
              <th scope="col">Удержания</th>
              <th scope="col">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {analysis.rows.map((row) => (
              <tr key={row.sku}>
                <th scope="row">
                  <strong>{row.productName ?? row.sku}</strong>
                  <span>{row.sku}</span>
                </th>
                <td>{formatKopecks(row.profit.revenueKopecks)}</td>
                <td>{formatKopecks(row.profit.marketplaceExpensesKopecks)}</td>
                <td className={row.profit.isLoss ? "analysis-loss" : undefined}>
                  {formatKopecks(row.profit.operatingProfitKopecks)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const analysisRunRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"CSV" | "XLSX" | null>(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<ReportAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      setAnalysis(null);
      setError(result.message);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setFormat(result.format);
    setAnalysis(null);
    setError("");
  }

  function clearSelection() {
    analysisRunRef.current += 1;
    setFile(null);
    setFormat(null);
    setAnalysis(null);
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
    setAnalysis(null);
    setError("");

    const runId = ++analysisRunRef.current;

    try {
      const parsed = await parseWildberriesApiPreviewWorkbook(file);
      if (analysisRunRef.current === runId) {
        setAnalysis(analyzeParsedReport(parsed));
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

      {analysis && <AnalysisResult analysis={analysis} />}
    </div>
  );
}
