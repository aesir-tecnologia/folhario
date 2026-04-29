import { redirect } from "next/navigation";

/**
 * Phase 4 D-26 — /settings root redirects to /settings/account.
 */
export default function SettingsPage(): never {
  redirect("/settings/account");
}
