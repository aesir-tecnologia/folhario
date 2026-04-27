/**
 * pt-BR locale formatters via Intl.* (UI-23).
 *
 * Currency: R$ 29,90 (NBSP between R$ and digits is Intl-default; consumers
 * may normalize for display if needed).
 * Date: dd/MM/yyyy.
 * Time: HH:mm (24h, no AM/PM, hour12: false).
 *
 * The `tz` arg on time/datetime helpers is the User.timezone injection point
 * (Phase 4+ wires this from User row). date-fns-tz is reserved for SSR-rendered
 * user-local times (see CLAUDE.md); MVP formatters use Intl.* only.
 */
const LOCALE = "pt-BR" as const;

export function formatCurrencyBRL(cents: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTime(d: Date | string, tz?: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(tz ? { timeZone: tz } : {}),
  }).format(date);
}

export function formatDateTime(d: Date | string, tz?: string): string {
  return `${formatDate(d)} ${formatTime(d, tz)}`;
}
