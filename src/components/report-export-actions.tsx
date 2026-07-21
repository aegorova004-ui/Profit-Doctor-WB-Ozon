"use client";

import { useState } from "react";
import type { ReportAnalysis } from "@/domain/reports/analyze-report";
import {
  buildReportCsv,
  buildReportWorkbookSheets,
  createReportExportFileName,
} from "@/domain/reports/export-report";

type ReportExportActionsProps = {
  analysis: ReportAnalysis;
  sourceFileName: string;
};

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export function ReportExportActions({
  analysis,
  sourceFileName,
}: ReportExportActionsProps) {
  const [isCreatingXlsx, setIsCreatingXlsx] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleCsvDownload() {
    setMessage("");
    setError("");

    try {
      const csv = buildReportCsv({
        analysis,
        sourceFileName,
        createdAtIso: new Date().toISOString(),
      });
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        createReportExportFileName(sourceFileName, "csv"),
      );
      setMessage(
        "CSV готов. Это технический формат без оформления; для просмотра в Excel выбирайте XLSX.",
      );
    } catch {
      setError(
        "Не удалось скачать CSV. Проверьте, что браузер не блокирует загрузки, или попробуйте XLSX.",
      );
    }
  }

  async function handleXlsxDownload() {
    setIsCreatingXlsx(true);
    setMessage("");
    setError("");

    try {
      const { default: writeXlsxFile } =
        await import("write-excel-file/browser");
      const workbook = writeXlsxFile(
        buildReportWorkbookSheets({
          analysis,
          sourceFileName,
          createdAtIso: new Date().toISOString(),
        }),
        { fontFamily: "Arial", fontSize: 11 },
      );
      const blob = await workbook.toBlob();
      downloadBlob(blob, createReportExportFileName(sourceFileName, "xlsx"));
      setMessage(
        "XLSX готов. Откройте файл с расширением .xlsx — в нём сохранены ширины колонок и два листа.",
      );
    } catch {
      setError("Не удалось создать XLSX. Попробуйте скачать CSV.");
    } finally {
      setIsCreatingXlsx(false);
    }
  }

  return (
    <section className="report-export" aria-labelledby="report-export-title">
      <div>
        <p className="eyebrow eyebrow-dark">Экспорт результата</p>
        <h3 id="report-export-title">Сохраните диагноз для работы</h3>
        <p>
          Файл содержит текущий расчёт, статус полноты, версию формулы,
          источники сумм и рекомендации по каждому SKU.
        </p>
      </div>
      <div className="report-export-controls">
        <div className="report-export-actions">
          <button
            className="button report-export-secondary"
            type="button"
            onClick={handleCsvDownload}
          >
            CSV для импорта
            <small>Без оформления и ширины колонок</small>
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={isCreatingXlsx}
            onClick={handleXlsxDownload}
          >
            {isCreatingXlsx ? "Создаём XLSX…" : "XLSX для Excel"}
            <small>Оформленный файл с двумя листами</small>
          </button>
        </div>
        <p className="report-export-format-note">
          Для просмотра выбирайте XLSX. CSV нужен для импорта и не хранит
          оформление таблицы.
        </p>
      </div>
      <div className="report-export-status" aria-live="polite">
        {message && <p>{message}</p>}
        {error && <p className="report-export-error">{error}</p>}
      </div>
    </section>
  );
}
