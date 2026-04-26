// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 — Species & Care bounded-context events. Care guides are
// asynchronously augmented after a successful identification, then
// published into the user-visible catalog. The actual augmentation
// worker (`care-guide/augment` per PRD §3) is Phase 4 work.

export const SpeciesCareEvents = {
  CareGuideAugmented: "care_guide.augmented",
  CareGuidePublished: "care_guide.published",
} as const;

export type SpeciesCareEventName =
  (typeof SpeciesCareEvents)[keyof typeof SpeciesCareEvents];

export interface CareGuideAugmentedPayload {
  speciesId: string;
  careGuideId: string;
  locale: string;
  version: string;
  source: "augmented";
  augmentedAt: string;
}

export interface CareGuidePublishedPayload {
  speciesId: string;
  careGuideId: string;
  locale: string;
  version: string;
  publishedAt: string;
}
