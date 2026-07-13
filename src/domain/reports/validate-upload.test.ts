import { describe, expect, it } from "vitest";

import {
  MAX_REPORT_FILE_SIZE_BYTES,
  validateReportFile,
} from "./validate-upload";

describe("validateReportFile", () => {
  it.each([
    ["report.csv", "text/csv", "CSV"],
    [
      "report.XLSX",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "XLSX",
    ],
  ] as const)("accepts %s", (name, type, format) => {
    expect(validateReportFile({ name, type, size: 1024 })).toEqual({
      ok: true,
      format,
    });
  });

  it("rejects an unsupported extension", () => {
    expect(
      validateReportFile({ name: "report.xls", type: "", size: 1024 }),
    ).toMatchObject({ ok: false });
  });

  it("rejects a mismatched MIME type", () => {
    expect(
      validateReportFile({
        name: "report.csv",
        type: "application/pdf",
        size: 1024,
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects an empty file", () => {
    expect(
      validateReportFile({ name: "report.csv", type: "text/csv", size: 0 }),
    ).toMatchObject({ ok: false });
  });

  it("rejects a file larger than 10 MB", () => {
    expect(
      validateReportFile({
        name: "report.xlsx",
        type: "application/octet-stream",
        size: MAX_REPORT_FILE_SIZE_BYTES + 1,
      }),
    ).toMatchObject({ ok: false });
  });
});
