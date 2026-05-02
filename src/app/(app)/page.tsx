import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { db } from "@shared/db/client";
import { countForUser } from "@contexts/catalog/infrastructure/db/plants";
import { CaptureButton } from "@shared/ui/capture-button";

export default async function HomePage() {
  const auth = await getCurrentUserFromSessionReadOnly();
  if (!auth.ok) {
    redirect("/auth/login");
  }

  const count = await countForUser(db, auth.user.id);
  const t = await getTranslations("home");

  if (count === 0) {
    return (
      <div
        data-testid="home-empty"
        className="
          flex min-h-[calc(100dvh-64px-80px)] flex-col items-center
          justify-center gap-6 px-5 py-8 text-center
        "
      >
        <h1
          className="
            font-serif text-[32px] leading-[38px] font-medium text-forest
          "
        >
          {t("empty.title")}
        </h1>
        <p className="text-base text-slate">{t("empty.hint")}</p>
        <div className="mt-24">
          <Link href="/identify" aria-label={t("empty.cta")}>
            <CaptureButton aria-label={t("empty.cta")} breathing />
          </Link>
        </div>
        <Link
          href="/catalog/add"
          className="
            mt-6 text-canopy underline-offset-2
            hover:underline
          "
        >
          {t("empty.manualLink")}
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="home-bridge"
      className="
        flex min-h-[calc(100dvh-64px-80px)] flex-col items-center justify-center
        gap-6 px-5 py-8 text-center
      "
    >
      <p className="text-base text-forest">{t("bridge.body", { count })}</p>
      <Link
        href="/catalog"
        className="
          mt-4 text-canopy underline-offset-2
          hover:underline
        "
      >
        {t("bridge.cta")}
      </Link>
    </div>
  );
}
