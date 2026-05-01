import { notFound } from "next/navigation";

import { InlineEditFieldTestHarness } from "./harness";

export default function InlineEditFieldTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <InlineEditFieldTestHarness />;
}
