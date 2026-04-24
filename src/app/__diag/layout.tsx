import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { serverEnv } from "@shared/config/server-env";

export default function DiagLayout({ children }: { children: ReactNode }) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") notFound();
  return children;
}
