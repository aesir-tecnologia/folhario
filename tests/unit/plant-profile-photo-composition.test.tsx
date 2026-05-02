import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("next-intl", () => {
  const t = (key: string, vars?: Record<string, unknown>) => {
    if (vars) {
      const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
      return `${key}(${parts.join(",")})`;
    }
    return key;
  };
  t.raw = () => [];
  return {
    useTranslations: () => t,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, @typescript-eslint/no-explicit-any
  default: ({ src, alt, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));

vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@contexts/billing/application/use-subscription", () => ({
  useSubscription: () => ({ readOnly: false, status: "active" }),
}));

vi.mock("../../src/app/(app)/catalog/[plantId]/use-plant-profile-mutations", () => ({
  usePatchPlantField: () => ({ mutateAsync: vi.fn() }),
  useDeletePlant: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
}));

vi.mock("../../src/app/(app)/catalog/[plantId]/delete-confirm-sheet", () => ({
  DeleteConfirmSheet: () => null,
}));

vi.mock("@shared/ui/inline-edit-field", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InlineEditField: ({ value, label }: any) => (
    <span data-testid={`inline-edit-${label}`}>{value ?? ""}</span>
  ),
}));

vi.mock("@shared/ui/location-combobox", () => ({
  LocationCombobox: () => <div data-testid="location-combobox" />,
}));

// Observable Lightbox — exposes slides via DOM so the test can assert
// the composed slide list (cover first, then non-cover, no duplicates).
vi.mock("@shared/ui/lightbox", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Lightbox: ({ open, photos }: any) =>
    open ? (
      <div data-testid="lightbox">
        {photos.map((p: { id: string; src: string; caption?: string }, i: number) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} data-testid={`lightbox-slide-${i}`} src={p.src} alt={p.caption ?? ""} />
        ))}
      </div>
    ) : null,
}));

import { PlantProfile } from "../../src/app/(app)/catalog/[plantId]/plant-profile";
import {
  plantsKeys,
  locationsKeys,
  type PlantPhotoEntry,
  type PlantDetailResponse,
} from "@contexts/catalog/queries";

const PLANT_ID = "plant-1";

// listPhotoEntries returns newest-first (D-03). The COVER is the oldest entry,
// matched by photo_url to PlantDetail.cover_photo_url.
const NEWEST: PlantPhotoEntry = {
  id: "entry-newest",
  plant_id: PLANT_ID,
  photo_url: "https://example.com/newest.jpg",
  thumbnail_url: "https://example.com/newest-thumb.jpg",
  photo_signed_url: "https://signed.example.com/newest.jpg?sig=N",
  thumbnail_signed_url: "https://signed.example.com/newest-thumb.jpg?sig=N",
  note: "newest",
  created_at: "2026-05-01T10:00:00.000Z",
};

const MIDDLE: PlantPhotoEntry = {
  id: "entry-middle",
  plant_id: PLANT_ID,
  photo_url: "https://example.com/middle.jpg",
  thumbnail_url: "https://example.com/middle-thumb.jpg",
  photo_signed_url: "https://signed.example.com/middle.jpg?sig=M",
  thumbnail_signed_url: "https://signed.example.com/middle-thumb.jpg?sig=M",
  note: "middle",
  created_at: "2026-04-01T10:00:00.000Z",
};

const OLDEST_COVER: PlantPhotoEntry = {
  id: "entry-cover",
  plant_id: PLANT_ID,
  photo_url: "https://example.com/cover.jpg",
  thumbnail_url: "https://example.com/cover-thumb.jpg",
  photo_signed_url: "https://signed.example.com/cover.jpg?sig=C",
  thumbnail_signed_url: "https://signed.example.com/cover-thumb.jpg?sig=C",
  note: null,
  created_at: "2026-03-01T10:00:00.000Z",
};

const PLANT_DETAIL_RESPONSE: PlantDetailResponse = {
  plant: {
    id: PLANT_ID,
    name: "Hera",
    nickname: null,
    location: "sala",
    acquisition_date: "2026-03-01",
    notes: null,
    cover_signed_url: "https://signed.example.com/cover.jpg?sig=C",
    cover_photo_url: OLDEST_COVER.photo_url,
  },
  _meta: { photo_entry_count: 3, reminder_count: 0 },
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
}

function wrap(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function seed(qc: QueryClient, entries: PlantPhotoEntry[]) {
  qc.setQueryData(plantsKeys.detail(PLANT_ID).queryKey, PLANT_DETAIL_RESPONSE);
  qc.setQueryData(plantsKeys.photoEntries(PLANT_ID).queryKey, { items: entries });
  qc.setQueryData(locationsKeys.all().queryKey, { locations: [] });
}

beforeEach(() => {
  // jsdom needs window.history for the back-button branch.
  // No fetch/UUID setup needed — query data is pre-seeded.
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PlantProfile — NEW-CR-01 photo composition (cover dedup + newest reachable)", () => {
  it("thumbnail strip excludes the cover and lists non-cover entries newest-first (max 3)", () => {
    const qc = makeQueryClient();
    // Newest-first list: NEWEST, MIDDLE, OLDEST_COVER (cover is oldest).
    seed(qc, [NEWEST, MIDDLE, OLDEST_COVER]);

    render(<PlantProfile plantId={PLANT_ID} />, { wrapper: wrap(qc) });

    // The 3-thumb strip lives directly below the cover button.
    // Each thumb has aria-label matching photoIndexOf(index=N+2,name=Hera).
    const stripButtons = screen.getAllByRole("button", { name: /photoIndexOf/ });
    expect(stripButtons.length).toBe(2); // 3 entries minus 1 cover.

    const stripImgs = stripButtons.map((b) => within(b).getByRole("img") as HTMLImageElement);
    const stripSrcs = stripImgs.map((img) => img.src);

    // Newest must be present in the strip (regression guard for old slice(1) bug
    // that skipped the newest entry).
    expect(stripSrcs).toContain(NEWEST.thumbnail_url);
    // Middle (other non-cover entry) is also in the strip.
    expect(stripSrcs).toContain(MIDDLE.thumbnail_url);
    // The cover's thumbnail must NOT appear in the strip (cover is rendered
    // separately above the strip — including it would render the cover twice).
    expect(stripSrcs).not.toContain(OLDEST_COVER.thumbnail_url);

    // Order: strip is newest-first.
    expect(stripImgs[0]?.src).toBe(NEWEST.thumbnail_url);
    expect(stripImgs[1]?.src).toBe(MIDDLE.thumbnail_url);
  });

  it("when 4+ non-cover photos exist, the strip caps at 3 and still leads with the newest", () => {
    const qc = makeQueryClient();

    const E5: PlantPhotoEntry = {
      ...NEWEST,
      id: "e5",
      photo_url: "u/e5.jpg",
      thumbnail_url: "u/e5-t.jpg",
      created_at: "2026-05-05T10:00:00Z",
    };
    const E4: PlantPhotoEntry = {
      ...NEWEST,
      id: "e4",
      photo_url: "u/e4.jpg",
      thumbnail_url: "u/e4-t.jpg",
      created_at: "2026-05-04T10:00:00Z",
    };
    const E3: PlantPhotoEntry = {
      ...NEWEST,
      id: "e3",
      photo_url: "u/e3.jpg",
      thumbnail_url: "u/e3-t.jpg",
      created_at: "2026-05-03T10:00:00Z",
    };
    const E2: PlantPhotoEntry = {
      ...NEWEST,
      id: "e2",
      photo_url: "u/e2.jpg",
      thumbnail_url: "u/e2-t.jpg",
      created_at: "2026-05-02T10:00:00Z",
    };

    // 5 entries, newest-first; cover is oldest.
    seed(qc, [E5, E4, E3, E2, OLDEST_COVER]);

    render(<PlantProfile plantId={PLANT_ID} />, { wrapper: wrap(qc) });

    const stripButtons = screen.getAllByRole("button", { name: /photoIndexOf/ });
    expect(stripButtons.length).toBe(3); // capped at 3

    const stripSrcs = stripButtons.map((b) => (within(b).getByRole("img") as HTMLImageElement).src);
    expect(stripSrcs[0]).toContain("e5-t.jpg"); // newest first
    expect(stripSrcs[1]).toContain("e4-t.jpg");
    expect(stripSrcs[2]).toContain("e3-t.jpg");
    // Cover never appears in strip.
    expect(stripSrcs.some((s) => s.includes("cover-thumb.jpg"))).toBe(false);
  });

  it("opening the lightbox produces a slide list where the cover appears exactly once and the newest is reachable", async () => {
    const qc = makeQueryClient();
    seed(qc, [NEWEST, MIDDLE, OLDEST_COVER]);

    render(<PlantProfile plantId={PLANT_ID} />, { wrapper: wrap(qc) });

    // Click the cover photo to open the lightbox at index 0.
    const coverButton = screen.getByRole("button", { name: /coverPhotoOf/ });
    await act(async () => {
      fireEvent.click(coverButton);
    });

    const lightbox = await screen.findByTestId("lightbox");
    const slideImgs = within(lightbox).getAllByRole("img") as HTMLImageElement[];

    // 3 entries → 3 slides (cover + 2 non-cover). No duplicates.
    expect(slideImgs.length).toBe(3);

    const slideSrcs = slideImgs.map((img) => img.src);
    // Slide 0 is the cover (signed URL from PlantDetail.cover_signed_url).
    expect(slideSrcs[0]).toBe(PLANT_DETAIL_RESPONSE.plant.cover_signed_url);
    // Newest must be present somewhere after the cover (regression guard).
    expect(slideSrcs).toContain(NEWEST.photo_signed_url);
    expect(slideSrcs).toContain(MIDDLE.photo_signed_url);

    // Cover's signed URL must appear exactly once across all slides.
    const coverSrc = PLANT_DETAIL_RESPONSE.plant.cover_signed_url!;
    const coverOccurrences = slideSrcs.filter((s) => s === coverSrc).length;
    expect(coverOccurrences).toBe(1);
  });
});
