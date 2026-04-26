import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@shared/config/server-env";
import {
  StorageAdapterError,
  type BucketSummary,
  type CreateSignedUrlInput,
  type CreateSignedUrlResult,
  type DeleteObjectInput,
  type DeletePrefixInput,
  type ListObjectsUnderPrefixInput,
  type StorageAdapter,
  type UploadObjectInput,
  type UploadObjectResult,
} from "@shared/adapters/storage";

/**
 * Supabase implementation of the `StorageAdapter`.
 *
 * Phase 02 Plan 08 — D-23 (service-role only, server-only),
 * D-25 (generic adapter), D-26 (path conventions enforced by per-context
 * helpers, not by the adapter itself).
 *
 * The Supabase JS client is constructed with `SUPABASE_SERVICE_ROLE_KEY`
 * which bypasses RLS — this file MUST NEVER be imported from client/edge
 * runtime. It is referenced only from server-side application code under
 * `/api/v1/*` route handlers and Inngest functions (Phase 4+).
 *
 * `auth: { persistSession: false, autoRefreshToken: false }` disables the
 * default browser-style auth machinery: this is a stateless service-role
 * client, not a user session.
 */

let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return cachedClient;
}

/**
 * For tests that need to swap in a fake Supabase client. Reset to `null`
 * after the test to restore the real factory.
 */
export function __setSupabaseClientForTests(client: SupabaseClient | null): void {
  cachedClient = client;
}

export function createSupabaseStorageAdapter(
  client: SupabaseClient = getSupabaseClient(),
): StorageAdapter {
  return {
    async listBuckets(): Promise<BucketSummary[]> {
      const { data, error } = await client.storage.listBuckets();
      if (error) {
        throw new StorageAdapterError(`listBuckets failed: ${error.message}`, error);
      }
      return (data ?? []).map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        public: bucket.public,
      }));
    },

    async uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
      const { bucket, objectKey, buffer, contentType, cacheControl } = input;
      const body = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
      const { error } = await client.storage.from(bucket).upload(objectKey, body, {
        contentType,
        cacheControl: cacheControl ?? "3600",
        upsert: false,
      });
      if (error) {
        throw new StorageAdapterError(
          `uploadObject failed for ${bucket}/${objectKey}: ${error.message}`,
          error,
        );
      }
      return { bucket, objectKey };
    },

    async createSignedUrl(input: CreateSignedUrlInput): Promise<CreateSignedUrlResult> {
      const { bucket, objectKey, expiresInSeconds } = input;
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(objectKey, expiresInSeconds);
      if (error || !data) {
        throw new StorageAdapterError(
          `createSignedUrl failed for ${bucket}/${objectKey}: ${error?.message ?? "no data"}`,
          error,
        );
      }
      return { signedUrl: data.signedUrl };
    },

    async deletePrefix(input: DeletePrefixInput): Promise<void> {
      const { bucket, prefix } = input;
      // Supabase Storage doesn't expose a recursive delete-by-prefix in the
      // JS SDK. We list the objects under the prefix and delete them in
      // batches. The list call is non-recursive by default, so we handle
      // sub-prefixes (e.g. `userId/plantId/`) by recursing.
      const objectKeys = await collectObjectsRecursively(client, bucket, prefix);
      if (objectKeys.length === 0) return;
      // Supabase remove() accepts an array of full object keys.
      const { error } = await client.storage.from(bucket).remove(objectKeys);
      if (error) {
        throw new StorageAdapterError(
          `deletePrefix failed for ${bucket}/${prefix}: ${error.message}`,
          error,
        );
      }
    },

    async deleteObject(input: DeleteObjectInput): Promise<void> {
      // CR-01: single-object delete via remove([objectKey]). Do NOT route
      // through deletePrefix — the SDK's list() treats its argument as a
      // folder and silently no-ops on a file path.
      const { bucket, objectKey } = input;
      const { error } = await client.storage.from(bucket).remove([objectKey]);
      if (error) {
        throw new StorageAdapterError(
          `deleteObject failed for ${bucket}/${objectKey}: ${error.message}`,
          error,
        );
      }
    },

    async listObjectsUnderPrefix(input: ListObjectsUnderPrefixInput): Promise<string[]> {
      return collectObjectsRecursively(client, input.bucket, input.prefix);
    },
  };
}

async function collectObjectsRecursively(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  // Strip trailing slash for the SDK list call, which interprets the path
  // as a directory.
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const { data, error } = await client.storage.from(bucket).list(normalized, { limit: 1000 });
  if (error) {
    throw new StorageAdapterError(
      `list failed for ${bucket}/${normalized}: ${error.message}`,
      error,
    );
  }
  if (!data) return [];

  const results: string[] = [];
  for (const entry of data) {
    // Supabase list returns both files (with id !== null) and folders
    // (id === null). We recurse into folders.
    if (entry.id === null) {
      const subPrefix = `${normalized}/${entry.name}`;
      const sub = await collectObjectsRecursively(client, bucket, `${subPrefix}/`);
      results.push(...sub);
    } else {
      results.push(`${normalized}/${entry.name}`);
    }
  }
  return results;
}
