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

function buildLargeWildberriesFinanceCsv(rowCount: number) {
  const header = [
    "realizationreport_id",
    "date_from",
    "date_to",
    "currency_name",
    "subject_name",
    "nm_id",
    "barcode",
    "supplier_oper_name",
    "quantity",
    "retail_amount",
    "ppvz_for_pay",
    "delivery_rub",
    "penalty",
    "additional_payment",
    "storage_fee",
    "deduction",
    "acquiring_fee",
    "acceptance",
    "payment_processing",
    "cashback_amount",
    "seller_promo_discount",
    "loyalty_discount",
  ];

  const rows = Array.from({ length: rowCount }, (_, index) => {
    const number = index + 1;

    return [
      "300000009",
      "2026-07-01",
      "2026-07-31",
      "RUB",
      `Тестовый товар ${number}`,
      `${710000000 + number}`,
      `SYNTH-LARGE-${number.toString().padStart(3, "0")}`,
      "Продажа",
      "1",
      "1000",
      "700",
      "40",
      "0",
      "0",
      "10",
      "0",
      "15",
      "0",
      "5",
      "0",
      "0",
      "0",
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
        name: "Отчёт WB прочитан локально",
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
    const adapterStatus = within(screen.getByTestId("import-adapter-status"));
    expect(adapterStatus.getByText("Распознан адаптер")).toBeTruthy();
    expect(adapterStatus.getByText("WB · WB XLSX API preview")).toBeTruthy();
    expect(
      adapterStatus.getByText("wb:api-financial-report:preview-2026-07"),
    ).toBeTruthy();

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
      name: "Оценка результата по товарам WB",
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

    await user.click(screen.getByRole("button", { name: /CSV для импорта/ }));
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(
      (downloadClick.mock.instances[0] as HTMLAnchorElement).download,
    ).toBe("profit-doctor-wb-report.csv");
    expect(
      screen.getByText(
        "CSV готов. Это технический формат без оформления; для просмотра в Excel выбирайте XLSX.",
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /XLSX для Excel/ }));
    expect(
      await screen.findByText(
        "XLSX готов. Откройте файл с расширением .xlsx — в нём сохранены ширины колонок и два листа.",
      ),
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

  it("opens the bundled demo report without a manual file upload", async () => {
    const user = userEvent.setup();
    const buffer = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../tests/fixtures/reports/wb-financial-report-api-synthetic.xlsx",
      ),
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReportUpload />);

    await user.click(
      screen.getByRole("button", { name: "Открыть демо XLSX WB" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/demo/wb-financial-report-preview.xlsx",
      {
        cache: "no-store",
      },
    );
    expect(
      await screen.findByRole("heading", {
        name: "Отчёт WB прочитан локально",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("profit-doctor-demo-wb-financial.xlsx"),
    ).toBeTruthy();
    expect(screen.getByTestId("analysis-summary")).toBeTruthy();
  });

  it("shows a clear CSV export error when the browser blocks download", async () => {
    const user = userEvent.setup();
    const buffer = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../tests/fixtures/reports/wb-financial-report-api-synthetic.xlsx",
      ),
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
    }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("download blocked");
      }),
    });

    render(<ReportUpload />);

    await user.click(
      screen.getByRole("button", { name: "Открыть демо XLSX WB" }),
    );
    await screen.findByRole("heading", {
      name: "Отчёт WB прочитан локально",
    });

    await user.click(screen.getByRole("button", { name: /CSV для импорта/ }));

    expect(
      screen.getByText(
        "Не удалось скачать CSV. Проверьте, что браузер не блокирует загрузки, или попробуйте XLSX.",
      ),
    ).toBeTruthy();
  });

  it("shows the renamed WB XLSX demo template link", () => {
    render(<ReportUpload />);

    expect(
      screen
        .getByRole("link", { name: "WB XLSX — рабочий финансовый отчёт" })
        .getAttribute("href"),
    ).toBe("/demo/wb-financial-report-preview.xlsx");
  });

  it("opens the bundled demo CSV report without a manual file upload", async () => {
    const user = userEvent.setup();
    const csv = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../tests/fixtures/reports/wb-finance-api-public-like.csv",
      ),
      "utf8",
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv,
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReportUpload />);

    await user.click(
      screen.getByRole("button", { name: "Открыть демо CSV WB" }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/demo/wb-finance-api-preview.csv", {
      cache: "no-store",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Отчёт WB прочитан локально",
      }),
    ).toBeTruthy();
    expect(screen.getByText("profit-doctor-demo-wb-finance.csv")).toBeTruthy();
    expect(
      screen.getByText("Демо CSV WB открыт. Результат ниже обновлён."),
    ).toBeTruthy();
    expect(screen.getByText("3 операций")).toBeTruthy();
    expect(screen.getByText("2 SKU")).toBeTruthy();
  });

  it("opens the bundled Ozon demo CSV report without a manual file upload", async () => {
    const user = userEvent.setup();
    const csv = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../public/demo/ozon-finance-preview.csv",
      ),
      "utf8",
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv,
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReportUpload />);

    await user.click(
      screen.getByRole("button", { name: "Открыть демо CSV Ozon" }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/demo/ozon-finance-preview.csv", {
      cache: "no-store",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Отчёт Ozon прочитан локально",
      }),
    ).toBeTruthy();
    const adapterStatus = within(screen.getByTestId("import-adapter-status"));
    expect(
      adapterStatus.getByText("Ozon · Ozon CSV finance preview"),
    ).toBeTruthy();
    expect(
      adapterStatus.getByText("ozon:finance-report:csv:preview-2026-07"),
    ).toBeTruthy();
    expect(
      screen.getByText("profit-doctor-demo-ozon-finance.csv"),
    ).toBeTruthy();
    expect(
      screen.getByText("Демо CSV Ozon открыт. Результат ниже обновлён."),
    ).toBeTruthy();
    expect(screen.getByText("4 операций")).toBeTruthy();
    expect(screen.getByText("3 SKU")).toBeTruthy();
    const summary = within(screen.getByTestId("analysis-summary"));
    expect(
      summary.getByText("Удержания Ozon").nextElementSibling?.textContent,
    ).toBe("4 066 ₽");
  });

  it("shows direct links to all synthetic demo templates", () => {
    render(<ReportUpload />);

    expect(
      screen
        .getByRole("link", { name: "WB XLSX — рабочий финансовый отчёт" })
        .getAttribute("href"),
    ).toBe("/demo/wb-financial-report-preview.xlsx");
    expect(
      screen
        .getByRole("link", { name: "WB CSV — рабочий API-like finance" })
        .getAttribute("href"),
    ).toBe("/demo/wb-finance-api-preview.csv");
    expect(
      screen
        .getByRole("link", {
          name: "WB CSV — большой файл для проверки таблицы",
        })
        .getAttribute("href"),
    ).toBe("/demo/wb-finance-large-preview.csv");
    expect(
      screen
        .getByRole("link", {
          name: "WB XLSX — товарный каталог для проверки ошибки",
        })
        .getAttribute("href"),
    ).toBe("/demo/wb-product-catalog-not-finance.xlsx");
    expect(
      screen
        .getByRole("link", {
          name: "CSV — неизвестный формат для проверки ошибки",
        })
        .getAttribute("href"),
    ).toBe("/demo/unsupported-finance-format.csv");
    expect(
      screen
        .getByRole("link", {
          name: "Ozon CSV — рабочий preview finance",
        })
        .getAttribute("href"),
    ).toBe("/demo/ozon-finance-preview.csv");
  });

  it("analyzes a WB finance CSV preview report", async () => {
    const user = userEvent.setup();
    const csv = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../tests/fixtures/reports/wb-finance-api-public-like.csv",
      ),
      "utf8",
    );
    const file = new File([csv], "wb-finance.csv", {
      type: "text/csv",
    });

    render(<ReportUpload />);

    await user.upload(
      screen.getByLabelText("Выбрать отчёт с устройства", { exact: false }),
      file,
    );

    expect(
      screen.getByText(
        "CSV будет разобран preview-адаптером WB или Ozon по заголовкам. Если в файле есть только сервисные строки без SKU, расчёт остановится с объяснением.",
      ),
    ).toBeTruthy();
    const analyzeButton = screen.getByRole("button", {
      name: "Проверить отчёт локально",
    });
    expect((analyzeButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(analyzeButton);

    expect(
      await screen.findByRole("heading", {
        name: "Отчёт WB прочитан локально",
      }),
    ).toBeTruthy();
    expect(screen.getByText("3 операций")).toBeTruthy();
    expect(screen.getByText("2 SKU")).toBeTruthy();
    expect(
      screen.getByText(
        "В отчёте есть сервисные строки WB без SKU: 1. Preview-адаптер не распределяет их по товарам.",
      ),
    ).toBeTruthy();
    const summary = within(screen.getByTestId("analysis-summary"));
    expect(summary.getByText("Выручка").nextElementSibling?.textContent).toBe(
      "2 925 ₽",
    );
    expect(
      summary.getByText("Удержания WB").nextElementSibling?.textContent,
    ).toBe("1 834 ₽");
  });

  it("shows found and missing columns for an unsupported CSV report", async () => {
    const user = userEvent.setup();
    const file = new File(
      ["sku,offer_id,name\n100,OZON-100,Товар"],
      "bad.csv",
      {
        type: "text/csv",
      },
    );

    render(<ReportUpload />);

    await user.upload(
      screen.getByLabelText("Выбрать отчёт с устройства", { exact: false }),
      file,
    );
    await user.click(
      screen.getByRole("button", { name: "Проверить отчёт локально" }),
    );

    const title = await screen.findByRole("heading", {
      name: "Формат пока не поддерживается",
    });
    const diagnostic = title.closest("section");
    expect(diagnostic).not.toBeNull();
    const card = within(diagnostic as HTMLElement);
    expect(card.getByText("sku")).toBeTruthy();
    expect(card.getByText("offer_id")).toBeTruthy();
    expect(card.getByText("тип начисления")).toBeTruthy();
    expect(
      card.getByRole("link", { name: "Ozon CSV demo" }).getAttribute("href"),
    ).toBe("/demo/ozon-finance-preview.csv");
  });

  it("shows found columns and template links for a WB catalog XLSX uploaded instead of a report", async () => {
    const user = userEvent.setup();
    const buffer = await readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../public/demo/wb-product-catalog-not-finance.xlsx",
      ),
    );
    const file = new File([new Uint8Array(buffer)], "wb-catalog.xlsx", {
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

    const title = await screen.findByRole("heading", {
      name: "Это товарный каталог, не финансовый отчёт",
    });
    const diagnostic = title.closest("section");
    expect(diagnostic).not.toBeNull();
    const card = within(diagnostic as HTMLElement);
    expect(card.getByText("Категория")).toBeTruthy();
    expect(card.getByText("Название")).toBeTruthy();
    expect(card.getByText("for_pay")).toBeTruthy();
    expect(
      card.getByRole("link", { name: "WB XLSX demo" }).getAttribute("href"),
    ).toBe("/demo/wb-financial-report-preview.xlsx");
  });

  it("keeps a large CSV report readable through desktop and mobile result views", async () => {
    const user = userEvent.setup();
    const file = new File(
      [buildLargeWildberriesFinanceCsv(36)],
      "wb-large-finance.csv",
      {
        type: "text/csv",
      },
    );

    render(<ReportUpload />);

    await user.upload(
      screen.getByLabelText("Выбрать отчёт с устройства", { exact: false }),
      file,
    );
    await user.click(
      screen.getByRole("button", { name: "Проверить отчёт локально" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Отчёт WB прочитан локально",
      }),
    ).toBeTruthy();
    expect(screen.getByText("36 операций")).toBeTruthy();
    expect(screen.getByText("36 SKU")).toBeTruthy();
    expect(screen.getAllByTestId("analysis-mobile-card")).toHaveLength(36);

    const desktopTable = screen.getByRole("table", {
      name: "Оценка результата по товарам WB",
    });
    expect(
      within(desktopTable).getByRole("rowheader", {
        name: /Тестовый товар 36/,
      }),
    ).toBeTruthy();

    await user.type(
      screen.getByLabelText(
        "Себестоимость одной единицы для Тестовый товар 1, ₽",
      ),
      "600",
    );
    await user.click(
      screen.getByRole("button", { name: "Пересчитать прибыль" }),
    );

    expect(
      screen.getByText(
        "Себестоимость учтена для 1 из 36 SKU. Результат ниже обновлён.",
      ),
    ).toBeTruthy();
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
      name: "Отчёт WB прочитан локально",
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
