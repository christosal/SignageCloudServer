"use client";

import type { TrainPiMetrics } from "@/lib/types";
import { cn, formatDataSize } from "@/lib/utils";

type Props = {
  metrics: TrainPiMetrics | null | undefined;
  online: boolean;
  compact?: boolean;
};

function metricCard(
  label: string,
  value: string,
  sub?: string,
  compact?: boolean,
) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2",
        compact && "py-1.5",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-0.5 font-semibold text-slate-800", compact ? "text-xs" : "text-sm")}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function TrainPiMetricsGrid({ metrics, online, compact }: Props) {
  if (!online) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        Pi metrics update when the train is online.
      </p>
    );
  }

  const m = metrics;
  const hasAny =
    m &&
    (m.cpuPercent != null ||
      m.cpuTempC != null ||
      m.ramUsedPercent != null ||
      (m.storageTotalBytes != null && m.storageFreeBytes != null) ||
      (m.netRxBytes != null && m.netTxBytes != null));

  if (!hasAny || !m) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        No hardware metrics yet (older Pi server, or non-Linux/dev host).
      </p>
    );
  }

  const diskFree = formatDataSize(m.storageFreeBytes);
  const diskTotal = formatDataSize(m.storageTotalBytes);
  const rx = formatDataSize(m.netRxBytes);
  const tx = formatDataSize(m.netTxBytes);
  const iface = m.networkIface ?? "net";

  return (
    <div
      className={cn(
        "mt-3 grid gap-2",
        compact
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {metricCard("CPU", m.cpuPercent != null ? `${m.cpuPercent}%` : "—", "sampled", compact)}
      {metricCard("Temp", m.cpuTempC != null ? `${m.cpuTempC} °C` : "—", "SoC", compact)}
      {metricCard("RAM used", m.ramUsedPercent != null ? `${m.ramUsedPercent}%` : "—", undefined, compact)}
      {metricCard(
        "Storage",
        diskFree !== "—" && diskTotal !== "—" ? `${diskFree} free` : "—",
        diskFree !== "—" && diskTotal !== "—" ? `of ${diskTotal}` : undefined,
        compact,
      )}
      {metricCard(
        "Network",
        `${iface}: ↓ ${rx} · ↑ ${tx}`,
        "cumulative since boot",
        compact,
      )}
    </div>
  );
}
