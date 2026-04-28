// Phase 4 INFRA-10: Inngest serve() webhook handler (D-02 — single endpoint for all functions).
import { serve } from "inngest/next";
import { inngest } from "@shared/inngest/client";
import { registry } from "@shared/inngest/registry";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: registry,
});
