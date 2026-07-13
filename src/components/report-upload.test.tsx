// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportUpload } from "./report-upload";

const exportMocks = vi.hoisted(() => ({
  toBlob: vi.fn(async () => new Blob(["xlsx"])),
  writeXlsxFile: vi.fn(),
}));

vi.mock("write-excel-file/browser", () => ({
  default: exportMocks.writeXlsxFile.mockImplementation(() => ({
    toBlob: exportMocks.toBlob,
  })),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
    const summary = within(screen.getByTestId("analysis-summary"));
    expect(summary.getByText("Выручка").nextElementSibling?.textContent).toBe(
      "6 840 ₽",
    );
    expect(
      summary.getByText("Удержания WB").nextElementSibling?.textContent,
    ).toBe("3 062,50 ₽");
    expect(
      summary.getByText("Себестоимость").nextElementSibling?.textContent,
    ).toBe("0 ₽");
    expect(
      summary.getByText("Результат до рекламы").nextElementSibling?.textContent,
    ).toBe("3 777,50 ₽");
    expect(screen.getByText("4 операций")).toBeTruthy();
    expect(screen.getByText("3 SKU")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Пересчитать прибыль" }),
    );
    expect(
      screen.getByText("Введите себестоимость хотя бы для одного SKU."),
    ).toBeTruthy();

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
      summary.getByText("Себестоимость").nextElementSibling?.textContent,
    ).toBe("3 700 ₽");
    expect(
      summary.getByText("Результат до рекламы").nextElementSibling?.textContent,
    ).toBe("77,50 ₽");
    expect(screen.getByText("2 убыточных SKU")).toBeTruthy();
    const desktopTable = screen.getByRole("table", {
      name: "Оценка результата по товарам Wildberries",
    });
    expect(within(desktopTable).getAllByText("Убыток")).toHaveLength(2);
    expect(within(desktopTable).getAllByText("Пока в плюсе")).toHaveLength(1);
    const diagnosis = within(screen.getByTestId("profit-diagnosis"));
    expect(
      diagnosis.getByRole("heading", {
        name: "С чего начать восстановление прибыли",
      }),
    ).toBeTruthy();
    expect(
      diagnosis.getByText("Убыток проблемных SKU").nextElementSibling
        ?.textContent,
    ).toBe("269 ₽");
    expect(
      diagnosis.getByText("Запас SKU в плюсе").nextElementSibling?.textContent,
    ).toBe("346,50 ₽");
    expect(
      diagnosis.getByText("Первый приоритет").nextElementSibling?.textContent,
    ).toBe("Набор контейнеров");
    expect(
      diagnosis.getByText(
        (_, element) =>
          element?.textContent ===
          "Порог себестоимости до рекламы — 1 128,50 ₽ за период, или 1 128,50 ₽ за единицу.",
      ),
    ).toBeTruthy();
    expect(diagnosis.getAllByRole("article")).toHaveLength(3);
    const createObjectUrl = vi
      .fn()
      .mockReturnValueOnce("blob:csv")
      .mockReturnValueOnce("blob:xlsx");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const downloadClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: /Скачать CSV/ }));
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(
      (downloadClick.mock.instances[0] as HTMLAnchorElement).download,
    ).toBe("profit-doctor-wb-report.csv");
    expect(
      screen.getByText("CSV готов. Файл сохранён на устройство."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Скачать XLSX/ }));
    expect(
      await screen.findByText("XLSX готов. Файл сохранён на устройство."),
    ).toBeTruthy();
    expect(exportMocks.writeXlsxFile).toHaveBeenCalledTimes(1);
    expect(
      (downloadClick.mock.instances[1] as HTMLAnchorElement).download,
    ).toBe("profit-doctor-wb-report.xlsx");
    expect(
      screen.getByText(
        "Себестоимость учтена для 3 из 3 SKU. Результат ниже обновлён.",
      ),
    ).toBeTruthy();
    const costEditor = screen
      .getByRole("heading", { name: "Добавьте себестоимость товаров" })
      .closest("section");
    expect(costEditor).not.toBeNull();
    expect(
      within(costEditor as HTMLElement).getByText(
        "Себестоимость учтена для 3 из 3 SKU. Результат ниже обновлён.",
      ),
    ).toBeTruthy();
    expect(
      within(costEditor as HTMLElement)
        .getByRole("link", { name: "Показать результат ↓" })
        .getAttribute("href"),
    ).toBe("#analysis-title");
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
    const summary = within(screen.getByTestId("analysis-summary"));

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
      screen.getByText("Исправьте отмеченные суммы и повторите пересчёт."),
    ).toBeTruthy();
    expect(
      summary.getByText("Результат до рекламы").nextElementSibling?.textContent,
    ).toBe("3 777,50 ₽");
  });
});
