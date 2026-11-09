export type CsvFile = { csv: string; filename: string };

/**
 * Contract for CSV exports invoked from the browser:
 * - { ok: true, csv, filename }: a file;
 * - { ok: false, reason }: an expected, safe-to-show unavailable condition
 *   (production server actions sanitize thrown messages, so expected conditions
 *   are returned, never thrown);
 * - Response and legacy { csv, filename } are still accepted;
 * - anything thrown is an unexpected failure and is reported generically.
 */
export type CsvExportResult =
  | Response
  | CsvFile
  | { ok: true; csv: string; filename: string }
  | { ok: false; reason: string };

export type ResolvedCsvExport =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; reason: string };

export const GENERIC_EXPORT_FAILURE = "The report could not be generated. Please review its status and try again.";

export async function resolveCsvExport(result: CsvExportResult, filenameFallback?: string): Promise<ResolvedCsvExport> {
  if (result instanceof Response) {
    if (!result.ok) throw new Error(`CSV export failed with status ${result.status}.`);
    const blob = await result.blob();
    if (!blob.size) throw new Error("CSV export returned an empty response.");
    const disposition = result.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    return { ok: true, blob, filename: match?.[1] ?? filenameFallback ?? `export-${Date.now()}.csv` };
  }
  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
    const reason = typeof result.reason === "string" && result.reason.trim() ? result.reason : GENERIC_EXPORT_FAILURE;
    return { ok: false, reason };
  }
  if (result && typeof result === "object" && typeof (result as CsvFile).csv === "string" &&
      typeof (result as CsvFile).filename === "string") {
    const file = result as CsvFile;
    const blob = new Blob([file.csv], { type: "text/csv;charset=utf-8" });
    if (!blob.size) throw new Error("CSV export returned an empty response.");
    return { ok: true, blob, filename: file.filename };
  }
  throw new Error("CSV export returned an unsupported result.");
}
