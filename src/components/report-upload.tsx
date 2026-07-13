"use client";

import { ChangeEvent, useRef, useState } from "react";
import { validateReportFile } from "@/domain/reports/validate-upload";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

export function ReportUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"CSV" | "XLSX" | null>(null);
  const [error, setError] = useState("");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const result = validateReportFile(selectedFile);
    if (!result.ok) {
      setFile(null);
      setFormat(null);
      setError(result.message);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setFormat(result.format);
    setError("");
  }

  function clearSelection() {
    setFile(null);
    setFormat(null);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  return (
    <div className="upload-widget">
      <label
        className={`upload-dropzone${error ? "upload-dropzone-error" : ""}`}
        htmlFor="report-file"
      >
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
        <span>CSV или XLSX, максимум 10 МБ</span>
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
        Поддерживаются файлы CSV и XLSX размером до 10 мегабайт
      </p>
      <div id="upload-status" aria-live="polite">
        {error && (
          <p className="upload-message upload-error">
            <strong>Файл не подходит</strong>
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
      </div>

      <button
        className="button button-primary upload-submit"
        type="button"
        disabled
      >
        Передать на анализ — Sprint 1
      </button>
      <p className="upload-privacy">
        <span aria-hidden="true">●</span>
        Файл остаётся на устройстве: серверная загрузка и парсинг ещё не
        подключены
      </p>
    </div>
  );
}
