import sharp from "sharp";
import { describe, expect, it } from "vitest";

/**
 * Phase 02 Plan 08 Task 2 — sharp native-load smoke test.
 *
 * `sharp` is a native Node-only package. The upload route at
 * `src/app/api/v1/photos/upload/route.ts` exports `runtime = "nodejs"`,
 * but if the OS-specific binary cannot be loaded (wrong arch, missing
 * sharp-darwin-arm64, sharp-linux-x64, etc.), the route will throw at
 * first request with the cryptic "Could not load the sharp module"
 * message. This test fails LOUDLY in CI before any route is exercised.
 *
 * The strategy: import `sharp` at the top of the file (module-eval-time
 * binary load) and call `.metadata()` on a 1x1 PNG generated in-memory.
 * If the native binary is missing/wrong, the import or the first sharp
 * call will throw and this test will fail with a clear message that names
 * the platform/arch — saving someone half an hour of CI debugging.
 *
 * Threat T-02-22 mitigation. Plan 02-08 must_haves explicitly require
 * this test as a gate before the upload route is exercised.
 */

describe("Phase 02-08 Task 2 — sharp native binary smoke", () => {
  it("loads the sharp native binary and reads metadata from a 1x1 PNG", async () => {
    // Generate a 1x1 black PNG in memory.
    const buffer = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    // Read it back through sharp. If the native binary isn't loaded for the
    // current platform/arch, this is where it would throw.
    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
    try {
      metadata = await sharp(buffer).metadata();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `sharp() call failed on platform=${process.platform} arch=${process.arch}. ` +
          `Original error: ${reason}. ` +
          "If you see 'Could not load the sharp module', install OS-specific " +
          "binaries via `pnpm install --force` or check that the linux-x64 / " +
          "darwin-arm64 / win32-x64 sharp packages resolved correctly. The " +
          "sharp install path is `node_modules/@img/sharp-<platform>-<arch>/`.",
      );
    }

    expect(metadata.width).toBe(1);
    expect(metadata.height).toBe(1);
  });

  it("can resize a 1x1 PNG to a 1x1 thumbnail (full encode round-trip)", async () => {
    const buffer = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const thumb = await sharp(buffer).resize(2, 2).jpeg({ quality: 80 }).toBuffer();
    const meta = await sharp(thumb).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(2);
    expect(meta.height).toBe(2);
  });
});
