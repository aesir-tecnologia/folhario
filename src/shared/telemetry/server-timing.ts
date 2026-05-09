type TimingField = string | number | boolean | null | undefined;

type TimingFields = Record<string, TimingField>;

const DEFAULT_THRESHOLD_MS = 250;

function thresholdMs(): number {
  const raw = process.env.FOLHARIO_TIMING_THRESHOLD_MS;
  if (!raw) return DEFAULT_THRESHOLD_MS;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_THRESHOLD_MS;
}

function shouldLog(durationMs: number): boolean {
  return process.env.FOLHARIO_TIMING_LOGS === "1" || durationMs >= thresholdMs();
}

function formatFields(fields: TimingFields | undefined): string {
  if (!fields) return "";
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export async function timeServer<T>(
  label: string,
  fn: () => Promise<T>,
  fields?: TimingFields,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = Math.round((performance.now() - start) * 10) / 10;
    if (shouldLog(durationMs)) {
      console.info(`[timing] ${label} duration_ms=${durationMs}${formatFields(fields)}`);
    }
  }
}
