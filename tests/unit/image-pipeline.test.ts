import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@shared/config/errors";

/**
 * Phase 02 Plan 08 Task 1 RED → GREEN.
 *
 * Tests prove three behaviors of the image pipeline before any upload route
 * work begins:
 *
 *  1. `compressPlantPhoto(file)` calls `browser-image-compression` with the
 *     project's contracted options (`maxSizeMB: 1`, `useWebWorker: true`,
 *     `preserveExif: false`) — D-28/D-29 plus T-02-20 (GPS leakage via
 *     preserved EXIF).
 *
 *  2. `rejectGpsMetadata(buffer)` returns a `validation_failed` result when
 *     `exifr.gps()` reports coordinates and an `ok` result when it does not
 *     (D-30, INFRA-19, T-02-20 server-side defense in depth).
 *
 *  3. `rejectOversizeBuffer(buffer)` returns `validation_failed` when the
 *     supplied byte length exceeds the shared `MAX_UPLOAD_BYTES` constant
 *     and `ok` when it is at or below the limit. The boundary-plus-one
 *     literal `1_048_577` is asserted explicitly so the limit drift threat
 *     T-02-39 cannot regress silently (D-30 reconcile, plan 02-08 must_haves).
 *
 * The size constants live in `src/shared/images/limits.ts` so the upload
 * route, the application use-case, and the helpers all import the same
 * source of truth — never a hardcoded byte literal.
 */

vi.mock("browser-image-compression", () => {
  const mock = vi.fn(async (file: File) => file);
  return {
    default: mock,
    __esModule: true,
  };
});

vi.mock("exifr", () => {
  const gps = vi.fn();
  return {
    default: { gps },
    gps,
    __esModule: true,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Phase 02-08 Task 1 — image limits constants", () => {
  it("MAX_UPLOAD_BYTES is exactly 1 MiB (1_048_576)", async () => {
    const limits = await import("@shared/images/limits");
    expect(limits.MAX_UPLOAD_BYTES).toBe(1_048_576);
  });

  it("CLIENT_COMPRESSION_TARGET_MB is 1 (browser-image-compression's MB API)", async () => {
    const limits = await import("@shared/images/limits");
    expect(limits.CLIENT_COMPRESSION_TARGET_MB).toBe(1);
  });

  it("CLIENT_COMPRESSION_TARGET_MB (in bytes) is strictly below MAX_UPLOAD_BYTES (T-02-39 boundary)", async () => {
    const limits = await import("@shared/images/limits");
    // 1 MB = 1_000_000 bytes; 1 MiB = 1_048_576 bytes. Client target must
    // be below the server reject boundary to avoid drift-induced rejects.
    const clientTargetBytes = limits.CLIENT_COMPRESSION_TARGET_MB * 1_000_000;
    expect(clientTargetBytes).toBeLessThan(limits.MAX_UPLOAD_BYTES);
  });
});

describe("Phase 02-08 Task 1 — compressPlantPhoto", () => {
  it("calls browser-image-compression with maxSizeMB: CLIENT_COMPRESSION_TARGET_MB and preserveExif: false", async () => {
    const { compressPlantPhoto } = await import("@shared/images/client-compress");
    const compressionMod = await import("browser-image-compression");
    const compressFn = compressionMod.default as unknown as ReturnType<typeof vi.fn>;

    const fakeFile = new File(["abc"], "plant.jpg", { type: "image/jpeg" });
    await compressPlantPhoto(fakeFile);

    expect(compressFn).toHaveBeenCalledTimes(1);
    const [, options] = compressFn.mock.calls[0]!;
    expect(options).toMatchObject({
      maxSizeMB: 1,
      useWebWorker: true,
      preserveExif: false,
    });
  });
});

describe("Phase 02-08 Task 1 — rejectGpsMetadata", () => {
  it("returns validation_failed when exifr.gps() returns coordinates", async () => {
    const { rejectGpsMetadata } = await import("@shared/images/server-validate");
    const exifrMod = await import("exifr");
    const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
    gpsFn.mockResolvedValueOnce({ latitude: -23.55052, longitude: -46.633308 });

    const result = await rejectGpsMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.ValidationFailed);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns ok when exifr.gps() returns null/undefined (no GPS data)", async () => {
    const { rejectGpsMetadata } = await import("@shared/images/server-validate");
    const exifrMod = await import("exifr");
    const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
    gpsFn.mockResolvedValueOnce(undefined);

    const result = await rejectGpsMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    expect(result.ok).toBe(true);
  });

  it("returns ok when exifr.gps() returns an object with no latitude/longitude", async () => {
    const { rejectGpsMetadata } = await import("@shared/images/server-validate");
    const exifrMod = await import("exifr");
    const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
    gpsFn.mockResolvedValueOnce({});

    const result = await rejectGpsMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    expect(result.ok).toBe(true);
  });

  it("returns ok when exifr.gps() throws (malformed metadata, treat as absent)", async () => {
    const { rejectGpsMetadata } = await import("@shared/images/server-validate");
    const exifrMod = await import("exifr");
    const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
    gpsFn.mockRejectedValueOnce(new Error("malformed jpeg"));

    const result = await rejectGpsMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    expect(result.ok).toBe(true);
  });
});

describe("Phase 02-08 Task 1 — rejectOversizeBuffer (T-02-39 boundary)", () => {
  it("returns ok at exactly MAX_UPLOAD_BYTES (1_048_576)", async () => {
    const { rejectOversizeBuffer } = await import("@shared/images/server-validate");
    const limits = await import("@shared/images/limits");
    const buf = Buffer.alloc(limits.MAX_UPLOAD_BYTES);
    const result = rejectOversizeBuffer(buf);
    expect(result.ok).toBe(true);
  });

  it("returns validation_failed at MAX_UPLOAD_BYTES + 1 (1_048_577)", async () => {
    const { rejectOversizeBuffer } = await import("@shared/images/server-validate");
    const buf = Buffer.alloc(1_048_577);
    const result = rejectOversizeBuffer(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.ValidationFailed);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns ok for an empty buffer (0 bytes is technically below the cap)", async () => {
    const { rejectOversizeBuffer } = await import("@shared/images/server-validate");
    const buf = Buffer.alloc(0);
    const result = rejectOversizeBuffer(buf);
    expect(result.ok).toBe(true);
  });
});
