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
      screen.getAllByText("Выручка", { selector: "dt" })[0].nextElementSibling
        ?.textContent,
    ).toBe("6 840 ₽");
    expect(
      screen.getByText("Удержания WB", { selector: "dt" }).nextElementSibling
        ?.textContent,
    ).toBe("3 062,50 ₽");
    expect(
      screen.getAllByText("Себестоимость", { selector: "dt" })[0]
        .nextElementSibling?.textContent,
    ).toBe("0 ₽");
    expect(
      screen.getByText("Результат до рекламы").nextElementSibling?.textContent,
    ).toBe("3 777,50 ₽");
    expect(screen.getByText("4 операций")).toBeTruthy();
    expect(screen.getByText("3 SKU")).toBeTruthy();

    await user.type(
      screen.getByLabelText(
        "Себестоимость одной единицы для Органайзер для дома, ₽",
      ),
      "900",
    );
    await user.type(
      screen.getByLabelText(
        "Себестоимость одной единицы для Бутылка для воды, ₽",
      ),
      "500",
    );
    await user.type(
      screen.getByLabelText(
        "Себестоимость одной единицы для Набор контейнеров, ₽",
      ),
      "1300",
    );
    await user.click(
      screen.getByRole("button", { name: "Пересчитать прибыль" }),
    );

    expect(
      screen.getAllByText("Себестоимость", { selector: "dt" })[0]
        .nextElementSibling?.textContent,
    ).toBe("3 700 ₽");
    expect(
      screen.getByText("Результат до рекламы").nextElementSibling?.textContent,
    ).toBe("77,50 ₽");
    expect(screen.getByText("2 убыточных SKU")).toBeTruthy();
    expect(screen.getAllByText("Убыток")).toHaveLength(2);
    expect(screen.getAllByText("Пока в плюсе")).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the previous calculation when a cost is invalid", async () => {
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

    render(<ReportUpload />);
    await user.upload(
      screen.getByLabelText("Выбрать отчёт с устройства", { exact: false }),
      file,
    );
    await user.click(
      screen.getByRole("button", { name: "Проверить отчёт локально" }),
    );
    await screen.findByRole("heading", {
      name: "Отчёт WB прочитан и сверен",
    });

    await user.type(
      screen.getByLabelText(
        "Себестоимость одной единицы для Органайзер для дома, ₽",
      ),
      "-1",
    );
    await user.click(
      screen.getByRole("button", { name: "Пересчитать прибыль" }),
    );

    expect(
      screen.getByText(
        "Введите неотрицательную сумму: например, 850 или 850,50",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Результат до рекламы").nextElementSibling?.textContent,
    ).toBe("3 777,50 ₽");
  });
});
