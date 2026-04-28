// Phase 4 D-16: care-guide-augment stub (Phase 7 replaces with real impl).
//
// PLANNER DEVIATION: the original 04-04 plan listed `src/contexts/care-guide/inngest/functions.ts`
// as a separate context — but `care-guide` is NOT a bounded context in this codebase.
// `careGuides` (the table) and all care-guide schemas live in `src/contexts/species-care/`
// (see `src/contexts/species-care/domain/events.ts` which already comments
// "// worker (`care-guide/augment` per PRD §3) is Phase 4 work."). Putting the stub here
// keeps the directory layout honest and avoids creating an orphan `care-guide` context.
import { inngest } from "@shared/inngest/client";

/** STUB — Phase 7 (care-guide augmentation triggered by identification.succeeded). */
const careGuideAugment = inngest.createFunction(
  { id: "care-guide-augment", triggers: [{ event: "identification.succeeded" }] },
  async () => ({ status: "not_implemented" }),
);

export const speciesCareFunctions = [careGuideAugment];
