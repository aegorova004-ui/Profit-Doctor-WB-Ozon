import type { ReportMarketplace } from "./parser";

const MARKETPLACE_MARKERS: Record<ReportMarketplace, readonly string[]> = {
  wildberries: [
    "код номенклатуры",
    "артикул поставщика",
    "обоснование для оплаты",
    "nm_id",
    "doc_type_name",
    "ppvz_for_pay",
    "supplier_oper_name",
    "realizationreport_id",
  ],
  ozon: ["sku", "offer_id", "тип начисления"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function detectReportMarketplace(
  headers: readonly string[],
): ReportMarketplace | null {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const scores = Object.entries(MARKETPLACE_MARKERS).map(
    ([marketplace, markers]) => ({
      marketplace: marketplace as ReportMarketplace,
      score: markers.filter((marker) => normalizedHeaders.has(marker)).length,
    }),
  );
  const [best, second] = scores.sort((left, right) => right.score - left.score);

  if (!best || best.score < 2 || best.score === second?.score) {
    return null;
  }

  return best.marketplace;
}
