// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportUpload } from "./report-upload";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReportUpload", () => {
  it("analyzes the synthetic WB XLSX without a server request", async () => {
    const user = userEvent.setup();
    const buffer = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../tests/fixtures/reports/wb-financial-report-api-synthetic.xlsx",
      ),
    );
    const file = new File([new Uint8Array(buffer)], "wb-report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<ReportUpload />);

    const input = screen.getByLabelText("Выбрать отчёт с устройства", {
      exact: false,
    });
    await user.upload(input, file);

    const analyzeButton = screen.getByRole("button", {
      name: "Проверить отчёт локально",
    });
    expect((analyzeButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(analyzeButton);

    expect(
      await screen.findByRole("heading", {
        name: "Отчёт WB прочитан и сверен",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("Выручка", { selector: "dt" }).nextElementSibling
        ?.textContent,
    ).toBe("6 840 ₽");
    expect(
      screen.getByText("Учтённые расходы").nextElementSibling?.textContent,
    ).toBe("3 062,50 ₽");
    expect(
      screen.getByText("Оценка остатка").nextElementSibling?.textContent,
    ).toBe("3 777,50 ₽");
    expect(screen.getByText("4 операций")).toBeTruthy();
    expect(screen.getByText("3 SKU")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
