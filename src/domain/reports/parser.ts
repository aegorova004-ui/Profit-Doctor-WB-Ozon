export type ReportMarketplace = "wildberries" | "ozon";

export type ReportFileDescriptor = {
  name: string;
  extension: ".csv" | ".xlsx";
  mimeType: string;
  sizeBytes: number;
};

export type NormalizedReportRow = {
  sourceRowNumber: number;
  sku: string;
  offerId: string | null;
  productName: string | null;
  quantity: number;
  revenueKopecks: number | null;
  marketplaceCommissionKopecks: number | null;
  logisticsKopecks: number | null;
  storageKopecks: number | null;
  returnsKopecks: number | null;
  penaltiesKopecks: number | null;
  advertisingKopecks: number | null;
  costOfGoodsKopecks: number | null;
  otherExpensesKopecks: number | null;
};

export type ParseWarning = {
  code: string;
  message: string;
  sourceRowNumber?: number;
};

export type ParsedReport = {
  marketplace: ReportMarketplace;
  rows: NormalizedReportRow[];
  warnings: ParseWarning[];
  missingColumns: string[];
};

export interface MarketplaceReportParser {
  readonly marketplace: ReportMarketplace;
  canParse(
    file: ReportFileDescriptor,
    headers: readonly string[],
  ): boolean | Promise<boolean>;
  parse(
    file: ReportFileDescriptor,
    contents: ArrayBuffer,
  ): Promise<ParsedReport>;
}
