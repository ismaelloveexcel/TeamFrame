"use client";

import { useMemo, useState } from "react";
import { trackExportAction } from "./export-actions";

type ExportRow = {
  employee_name: string;
  work_email: string;
  designation: string;
  department: string;
  base_salary: string;
  currency: string;
  pay_frequency: string;
  bank_name: string;
  bank_account: string;
  bank_code: string;
  employment_status: string;
  export_readiness: string;
  readiness_notes: string;
};

function csvEscape(value: string): string {
  const normalized = value.replaceAll("\r\n", "\n");
  if (normalized.includes(",") || normalized.includes("\"") || normalized.includes("\n")) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }
  return normalized;
}

function toCsv(rows: ExportRow[]): string {
  const firstRow = rows[0];
  if (!firstRow) {
    return "";
  }
  const headers = Object.keys(firstRow) as Array<keyof ExportRow>;
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers.map((header) => csvEscape(row[header] ?? "")).join(",");
    lines.push(line);
  }

  return `${lines.join("\n")}\n`;
}

function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportCsvButton({ rows }: { rows: ExportRow[] }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [lastTrackingPayload, setLastTrackingPayload] = useState<{
    recordCount: number;
    unresolvedIssues: number;
    includeInactive: boolean;
    readinessStatus: "ready" | "blocked";
  } | null>(null);

  const filteredRows = useMemo(() => {
    if (includeInactive) return rows;
    return rows.filter((row) => row.employment_status.toLowerCase() !== "inactive");
  }, [includeInactive, rows]);

  const inactiveCount = useMemo(
    () => rows.filter((row) => row.employment_status.toLowerCase() === "inactive").length,
    [rows],
  );

  const blockedCount = useMemo(
    () => filteredRows.filter((row) => row.export_readiness === "Export blocked").length,
    [filteredRows],
  );

  const handleExport = async () => {
    if (filteredRows.length === 0) return;
    setIsExporting(true);
    setTrackingError(null);

    const trackingPayload = {
      recordCount: filteredRows.length,
      unresolvedIssues: blockedCount,
      includeInactive,
      readinessStatus: blockedCount === 0 ? "ready" : "blocked",
    } as const;

    const trackingResult = await trackExportAction({
      exportType: "finance_csv",
      recordCount: trackingPayload.recordCount,
      unresolvedIssues: trackingPayload.unresolvedIssues,
      includeInactive: trackingPayload.includeInactive,
      readinessStatus: trackingPayload.readinessStatus,
    });

    if (!trackingResult.ok) {
      setLastTrackingPayload(trackingPayload);
      setTrackingError(trackingResult.message);
    }

    const today = new Date().toISOString().slice(0, 10);
    const csv = toCsv(filteredRows);
    downloadCsv(`teamframe-finance-export-${today}.csv`, csv);
    setIsExporting(false);
  };

  const handleRetryTracking = async () => {
    if (!lastTrackingPayload) return;
    setTrackingError(null);
    const retryResult = await trackExportAction({
      exportType: "finance_csv",
      recordCount: lastTrackingPayload.recordCount,
      unresolvedIssues: lastTrackingPayload.unresolvedIssues,
      includeInactive: lastTrackingPayload.includeInactive,
      readinessStatus: lastTrackingPayload.readinessStatus,
    });

    if (!retryResult.ok) {
      setTrackingError(retryResult.message);
      return;
    }

    setLastTrackingPayload(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={filteredRows.length === 0 || isExporting}
          className="tf-button-primary disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {isExporting ? "Preparing export..." : "Export CSV for finance"}
        </button>
        <label className="inline-flex items-center gap-2 text-[13px] text-ink-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Include inactive records
        </label>
      </div>

      <p className="text-[12px] text-ink-500">
        Spreadsheet-friendly export with finance field names. {filteredRows.length} rows selected.
      </p>

      {blockedCount > 0 ? (
        <p className="text-[12px] text-[#7a5314]">
          {blockedCount} selected rows are marked Export blocked. Resolve readiness warnings before handoff.
        </p>
      ) : null}

      {!includeInactive && inactiveCount > 0 ? (
        <p className="text-[12px] text-ink-500">
          {inactiveCount} inactive records are excluded by default.
        </p>
      ) : null}

      {trackingError ? (
        <div className="rounded-md border border-ink-300 bg-white/80 px-3 py-2 text-[12px] text-ink-700">
          <p>{trackingError}</p>
          <button
            type="button"
            onClick={handleRetryTracking}
            className="mt-2 text-[12px] underline decoration-ink-300 underline-offset-4"
          >
            Retry tracking
          </button>
        </div>
      ) : null}
    </div>
  );
}
