import { db as defaultDb } from "@shared/db/client";
import * as locationSuggestionsRepo from "@contexts/catalog/infrastructure/db/location-suggestions";

// Static import matches existing codebase pattern (signup.ts:30, etc.)
// Path depth from src/contexts/catalog/application/* to src/messages/pt-BR.json: 3 levels up
import ptBR from "../../../messages/pt-BR.json";

export interface ListLocationsInput {
  userId: string;
}

export interface LocationItem {
  labelDisplay: string;
}

export type ListLocationsResult = { ok: true; items: LocationItem[] };

function normalizeLabel(label: string): string {
  return label.normalize("NFKC").toLowerCase().trim();
}

export async function listLocations(input: ListLocationsInput): Promise<ListLocationsResult> {
  // Fetch top 20 user suggestions ordered by usage_count DESC, last_used_at DESC (D-09).
  const saved = await locationSuggestionsRepo.listForUser(defaultDb, {
    userId: input.userId,
    limit: 20,
  });

  // D-10: static defaults from i18n bundle; defensive nullish chain.
  const defaults: string[] =
    (ptBR as { catalog?: { locations?: { defaults?: string[] } } }).catalog?.locations?.defaults ??
    [];

  // Merge: saved first (ordered by usage_count), then defaults — de-duped by NFKC+lower+trim.
  const seen = new Set<string>();
  const merged: LocationItem[] = [];

  for (const row of saved) {
    const norm = normalizeLabel(row.labelDisplay);
    if (seen.has(norm)) continue;
    seen.add(norm);
    merged.push({ labelDisplay: row.labelDisplay });
  }

  for (const def of defaults) {
    const norm = normalizeLabel(def);
    if (seen.has(norm)) continue;
    seen.add(norm);
    merged.push({ labelDisplay: def });
  }

  return { ok: true, items: merged };
}
