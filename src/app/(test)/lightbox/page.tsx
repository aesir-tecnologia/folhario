import { notFound } from "next/navigation";

import { LightboxTestHarness } from "./harness";

export default function LightboxTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <LightboxTestHarness />;
}
