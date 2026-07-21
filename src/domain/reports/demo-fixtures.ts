export type DemoReportAction = {
  href: string;
  downloadName: string;
  mimeType: string;
};

export type DemoTemplateLink = {
  href: string;
  label: string;
  description: string;
};

export const WB_XLSX_DEMO_REPORT: DemoReportAction = {
  href: "/demo/wb-financial-report-preview.xlsx",
  downloadName: "profit-doctor-demo-wb-financial.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const WB_CSV_DEMO_REPORT: DemoReportAction = {
  href: "/demo/wb-finance-api-preview.csv",
  downloadName: "profit-doctor-demo-wb-finance.csv",
  mimeType: "text/csv",
};

export const OZON_CSV_DEMO_REPORT: DemoReportAction = {
  href: "/demo/ozon-finance-preview.csv",
  downloadName: "profit-doctor-demo-ozon-finance.csv",
  mimeType: "text/csv",
};

export const DEMO_TEMPLATE_LINKS = [
  {
    href: WB_XLSX_DEMO_REPORT.href,
    label: "WB XLSX demo",
    description: "WB XLSX — рабочий финансовый отчёт",
  },
  {
    href: WB_CSV_DEMO_REPORT.href,
    label: "WB CSV demo",
    description: "WB CSV — рабочий API-like finance",
  },
  {
    href: "/demo/wb-finance-large-preview.csv",
    label: "WB large CSV demo",
    description: "WB CSV — большой файл для проверки таблицы",
  },
  {
    href: "/demo/wb-product-catalog-not-finance.xlsx",
    label: "WB catalog XLSX negative demo",
    description: "WB XLSX — товарный каталог для проверки ошибки",
  },
  {
    href: "/demo/unsupported-finance-format.csv",
    label: "Unsupported CSV negative demo",
    description: "CSV — неизвестный формат для проверки ошибки",
  },
  {
    href: OZON_CSV_DEMO_REPORT.href,
    label: "Ozon CSV demo",
    description: "Ozon CSV — рабочий preview finance",
  },
] as const;

export const PUBLIC_DEMO_FILE_NAMES = DEMO_TEMPLATE_LINKS.map((template) =>
  template.href.replace("/demo/", ""),
);
