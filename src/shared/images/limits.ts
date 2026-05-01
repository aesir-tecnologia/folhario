/**
 * Single source of truth for image-size limits across client and server.
 *
 * Phase 02 Plan 08 — D-30 reconciliation, T-02-39 mitigation.
 *
 * The route reject threshold and the client compression target both flow
 * from this module so future drift cannot silently produce a regime where
 * client-compressed files are rejected by the server (or vice versa).
 *
 * Why two constants instead of one?
 * - `browser-image-compression`'s public API takes `maxSizeMB` (decimal MB).
 *   Setting `maxSizeMB: 1` lets the library aim for ~1 MB ≈ 953,674 bytes.
 * - The server reject boundary is 1 MiB = 1,048,576 bytes — the conventional
 *   binary value used everywhere else in the stack (Supabase Storage caps,
 *   HTTP byte units, etc.).
 *
 * Because 1 MB < 1 MiB, the client's compression target is comfortably
 * inside the server boundary. Any future change must preserve this
 * invariant: `CLIENT_COMPRESSION_TARGET_MB * 1_000_000 < MAX_UPLOAD_BYTES`.
 *
 * Defense in depth: the bucket cap (5 MiB on plant-photos, configured in
 * supabase/config.toml) is intentionally LOOSER than this route boundary.
 * The route is the primary check; the bucket cap is a wider safety net so
 * a route bug cannot bypass the boundary completely.
 */

/** Server-side reject threshold for /api/v1/photos/upload. 1 MiB exactly. */
export const MAX_UPLOAD_BYTES = 1_048_576;

/**
 * Target for client-side `browser-image-compression`. Lib API uses MB
 * (decimal), so this number is dimensionally MB, not MiB. Strictly less
 * than `MAX_UPLOAD_BYTES` once converted (1 MB ≈ 953,674 bytes < 1 MiB).
 */
export const CLIENT_COMPRESSION_TARGET_MB = 1;

export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);
export type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
