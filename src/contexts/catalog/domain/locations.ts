/**
 * Per-user location suggestion normalization (D-09 + D-10).
 *
 * Used by the location_suggestions repo to derive the composite-PK
 * `label_normalized` column from the user-typed `label_display`. Two
 * variants of the same place ("Varanda" / "varanda" / "varánda") MUST
 * collapse to one row in the suggestions table — otherwise the user
 * sees their own duplicate suggestions in the combobox.
 *
 * Implementation: trim, lowercase using pt-BR locale rules, NFD-decompose
 * to separate base char from combining marks, then strip combining marks
 * via the Unicode "Diacritic" property regex. Internal whitespace runs
 * collapse to a single space.
 */
export function normalizeLocationLabel(input: string): string {
  return input
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}
