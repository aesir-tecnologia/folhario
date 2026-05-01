// Phase 5 D-27: hermetic in-memory StorageAdapter for catalog integration tests.
// Opt-in per test file via useInMemoryStorageAdapter(); does NOT swap globally.
import type {
  BucketSummary,
  StorageAdapter,
  UploadObjectInput,
  UploadObjectResult,
  CreateSignedUrlInput,
  CreateSignedUrlResult,
  DeletePrefixInput,
  DeleteObjectInput,
  ListObjectsUnderPrefixInput,
} from "@shared/adapters/storage";

type ObjectEntry = { buffer: Buffer; contentType: string; cacheControl?: string };

export class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, Map<string, ObjectEntry>>();

  listBuckets(): Promise<BucketSummary[]> {
    return Promise.resolve([...this.store.keys()].map((name) => ({ name })));
  }

  uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
    const { bucket, objectKey, buffer, contentType, cacheControl } = input;
    if (!this.store.has(bucket)) {
      this.store.set(bucket, new Map());
    }
    this.store.get(bucket)!.set(objectKey, {
      buffer: Buffer.from(buffer),
      contentType,
      cacheControl,
    });
    return Promise.resolve({ bucket, objectKey });
  }

  createSignedUrl(input: CreateSignedUrlInput): Promise<CreateSignedUrlResult> {
    const { bucket, objectKey, expiresInSeconds } = input;
    const bucketMap = this.store.get(bucket);
    if (!bucketMap || !bucketMap.has(objectKey)) {
      return Promise.reject(
        new Error(`InMemoryStorageAdapter: object not found: ${bucket}/${objectKey}`),
      );
    }
    return Promise.resolve({
      signedUrl: `memory://${bucket}/${objectKey}?expires_in=${expiresInSeconds}`,
    });
  }

  deletePrefix(input: DeletePrefixInput): Promise<void> {
    const { bucket, prefix } = input;
    if (!prefix.endsWith("/")) return Promise.resolve();
    const bucketMap = this.store.get(bucket);
    if (!bucketMap) return Promise.resolve();
    for (const key of [...bucketMap.keys()]) {
      if (key.startsWith(prefix)) {
        bucketMap.delete(key);
      }
    }
    return Promise.resolve();
  }

  deleteObject(input: DeleteObjectInput): Promise<void> {
    const { bucket, objectKey } = input;
    this.store.get(bucket)?.delete(objectKey);
    return Promise.resolve();
  }

  listObjectsUnderPrefix(input: ListObjectsUnderPrefixInput): Promise<string[]> {
    const { bucket, prefix } = input;
    const bucketMap = this.store.get(bucket);
    if (!bucketMap) return Promise.resolve([]);
    const keys = [...bucketMap.keys()].filter((k) => k.startsWith(prefix));
    return Promise.resolve(keys);
  }

  clear(): void {
    this.store.clear();
  }
}
