/**
 * Generic StorageAdapter contract.
 *
 * Phase 02 Plan 08 — D-25 (two-tier storage API: shared adapter + per-context
 * helpers), D-23 (clients never call Storage directly; uploads go through
 * server adapters with service role).
 *
 * Application/use-case code calls context helpers (e.g.
 * `src/contexts/catalog/infrastructure/photo-storage.ts`); those helpers
 * delegate to a `StorageAdapter` instance. The adapter is server-only and
 * never reaches the browser bundle.
 *
 * The interface is deliberately minimal — `uploadObject`, `deletePrefix`,
 * `createSignedUrl`, `listBuckets`, `listObjectsUnderPrefix` — so the same
 * shape works for any future provider (S3, GCS, R2). LGPD prefix deletion
 * (`deletePrefix`) is part of the core surface because data-rights work in
 * Phase 11 must be able to sweep all of a user's objects atomically.
 */

export interface BucketSummary {
  id?: string;
  name: string;
  public?: boolean;
}

export interface UploadObjectInput {
  bucket: string;
  objectKey: string;
  buffer: Buffer | Uint8Array;
  contentType: string;
  /** Optional cache-control header to set on the stored object. */
  cacheControl?: string;
}

export interface UploadObjectResult {
  bucket: string;
  objectKey: string;
}

export interface CreateSignedUrlInput {
  bucket: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface CreateSignedUrlResult {
  signedUrl: string;
}

export interface DeletePrefixInput {
  bucket: string;
  /** Prefix INCLUDING any trailing slash, e.g. `${userId}/`. */
  prefix: string;
}

export interface DeleteObjectInput {
  bucket: string;
  /**
   * Full canonical object key (no bucket prefix). Use `deleteObject` for
   * single-file deletes (e.g. CR-03 compensating delete) — `deletePrefix`
   * is for folder-style sweeps and treats its argument as a directory,
   * which means passing a file path returns zero matches and silently
   * no-ops. CR-01: use this method for single-object deletes.
   */
  objectKey: string;
}

export interface ListObjectsUnderPrefixInput {
  bucket: string;
  prefix: string;
}

export interface StorageAdapter {
  listBuckets(): Promise<BucketSummary[]>;
  uploadObject(input: UploadObjectInput): Promise<UploadObjectResult>;
  createSignedUrl(input: CreateSignedUrlInput): Promise<CreateSignedUrlResult>;
  deletePrefix(input: DeletePrefixInput): Promise<void>;
  /**
   * Delete a single object by its full canonical key. Distinct from
   * `deletePrefix` — see `DeleteObjectInput.objectKey` doc. CR-01.
   */
  deleteObject(input: DeleteObjectInput): Promise<void>;
  listObjectsUnderPrefix(input: ListObjectsUnderPrefixInput): Promise<string[]>;
}

export class StorageAdapterError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageAdapterError";
  }
}
