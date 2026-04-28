// Phase 4 INFRA-10: Inngest client singleton (D-02 — app-owned auth email events).
import { Inngest } from "inngest";
import { serverEnv } from "@shared/config/server-env";

export const inngest = new Inngest({
  id: "folhario",
  eventKey: serverEnv.INNGEST_EVENT_KEY,
  signingKey: serverEnv.INNGEST_SIGNING_KEY,
});
