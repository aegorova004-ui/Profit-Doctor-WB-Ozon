type CsvRow = readonly string[];

function isEmptyRow(row: CsvRow): boolean {
  return row.every((cell) => cell.trim() === "");
}

function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t"] as const;
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: firstLine.split(delimiter).length,
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

export function parseCsvRows(text: string): CsvRow[] {
  const delimiter = detectDelimiter(
    text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "",
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!insideQuotes && (char === "\n" || char === "\r")) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";

      if (char === "\r" && next === "\n") {
        index += 1;
      }
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((candidate) => !isEmptyRow(candidate));
}
