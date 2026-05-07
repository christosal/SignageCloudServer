import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Human-readable byte size (binary units). */
export function formatDataSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded =
    i === 0 ? String(Math.round(v)) : v < 10 ? v.toFixed(1) : String(Math.round(v));
  return `${rounded} ${units[i]}`;
}
