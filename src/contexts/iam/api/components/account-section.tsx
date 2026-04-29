import { getTranslations } from "next-intl/server";

import type { UserWithCredentialFlag } from "@contexts/iam/infrastructure/db/users";

import { ChangePasswordForm } from "./change-password-form";
import { TimezoneForm } from "./timezone-form";
import { LogoutLink } from "./logout-link";

/**
 * Phase 4 UI-SPEC §8 — Settings → Account section.
 *
 * Three vertically-stacked cards:
 *   1. "Conta" — email row (read-only) + change-password card OR
 *      OAuth-only fallback notice (D-04 / AUTH-13).
 *   2. "Fuso horário" — current timezone + inline edit form.
 *   3. "Sair deste aparelho" — single-row tertiary action (per-device
 *      logout, AUTH-14 + D-05).
 *
 * Server component: reads pt-BR copy + the joined `UserWithCredentialFlag`
 * (carries `hasPassword` so the change-password form renders only for
 * email+password accounts).
 */
export async function AccountSection({ user }: { user: UserWithCredentialFlag }) {
  const t = await getTranslations("settings.account");

  return (
    <div className="flex flex-col gap-4">
      <article className="rounded-2xl border border-hairline bg-ivory p-4">
        <h2 className="mb-3 font-serif text-2xl font-medium text-forest">
          {t("cardTitle")}
        </h2>

        <div className="flex flex-col gap-1 border-b border-hairline pb-3">
          <p className="text-sm font-semibold text-forest">{t("emailLabel")}</p>
          <p className="text-sm text-slate">{user.email}</p>
        </div>

        <div className="pt-3">
          <p className="mb-2 text-sm font-semibold text-forest">
            {t("passwordRowTitle")}
          </p>
          {user.hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <p className="text-sm text-slate">{t("oauthOnlyNotice")}</p>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-hairline bg-ivory p-4">
        <TimezoneForm initialTimezone={user.timezone} />
      </article>

      <article className="rounded-2xl border border-hairline bg-ivory p-4">
        <LogoutLink
          translationKey="logoutRow"
          namespace="settings.account"
          className="block text-base text-canopy underline"
        />
      </article>
    </div>
  );
}
