import imageCompression from "browser-image-compression";

import { CLIENT_COMPRESSION_TARGET_MB } from "@shared/images/limits";

/**
 * Client-side image compression for plant photos.
 *
 * Phase 02 Plan 08 — D-28/D-29 (browser-image-compression with EXIF strip).
 *
 * `preserveExif: false` is the front-line defense against GPS metadata
 * leakage (T-02-20): the compression library rebuilds the JPEG without
 * the EXIF segment, so any latitude/longitude that was attached on capture
 * is removed before upload. The server STILL re-checks (defense in depth)
 * via `rejectGpsMetadata`, but stripping client-side avoids exfiltrating
 * coordinates onto our network at all.
 *
 * `useWebWorker: true` keeps the main thread responsive on lower-end
 * devices — the typical pt-BR launch handset.
 *
 * `maxSizeMB` is the library's API name (MB, not MiB). The constant
 * `CLIENT_COMPRESSION_TARGET_MB = 1` corresponds to ~953,674 bytes,
 * comfortably below the server's `MAX_UPLOAD_BYTES = 1_048_576` (1 MiB)
 * reject threshold. See `src/shared/images/limits.ts` for the boundary
 * reconciliation rationale (T-02-39).
 *
 * This module imports a browser-only dependency
 * (`browser-image-compression`). It MUST NOT be imported from server
 * code; it should only be referenced from client components.
 */
export async function compressPlantPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: CLIENT_COMPRESSION_TARGET_MB,
    useWebWorker: true,
    preserveExif: false,
  });
}
