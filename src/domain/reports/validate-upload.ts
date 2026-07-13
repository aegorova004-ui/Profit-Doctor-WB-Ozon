export const MAX_REPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);
const MIME_TYPES_BY_EXTENSION: Record<"csv" | "xlsx", ReadonlySet<string>> = {
  csv: new Set([
    "application/csv",
    "application/vnd.ms-excel",
    "text/comma-separated-values",
    "text/csv",
    "text/plain",
  ]),
  xlsx: new Set([
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
};

export type ReportFileCandidate = {
  name: string;
  size: number;
  type: string;
};

export type ReportFileValidationResult =
  { ok: true; format: "CSV" | "XLSX" } | { ok: false; message: string };

export function validateReportFile(
  file: ReportFileCandidate,
): ReportFileValidationResult {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension !== "csv" && extension !== "xlsx") {
    return {
      ok: false,
      message:
        "Выберите файл CSV или XLSX. Другие форматы пока не поддерживаются",
    };
  }

  if (
    !GENERIC_MIME_TYPES.has(file.type) &&
    !MIME_TYPES_BY_EXTENSION[extension].has(file.type)
  ) {
    return {
      ok: false,
      message:
        "Тип файла не похож на CSV или XLSX. Экспортируйте отчёт заново и повторите выбор",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      message: "Файл пуст. Выберите отчёт, в котором есть данные",
    };
  }

  if (file.size > MAX_REPORT_FILE_SIZE_BYTES) {
    return {
      ok: false,
      message:
        "Файл больше 10 МБ. Уменьшите отчёт или разделите его на несколько файлов",
    };
  }

  return { ok: true, format: extension.toUpperCase() as "CSV" | "XLSX" };
}
