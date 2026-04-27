import { getTranslations } from "next-intl/server";
import { OfflineFallback } from "./offline-fallback";

export default async function OfflinePage() {
  const t = await getTranslations("offline.page");
  return (
    <OfflineFallback
      title={t("title")}
      hint={t("hint")}
      cta={t("cta")}
    />
  );
}
