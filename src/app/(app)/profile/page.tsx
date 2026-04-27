import { getTranslations } from "next-intl/server";
import { getTheme } from "@shared/theme/use-theme";
import { ProfileThemeSelect } from "./profile-theme-toggle";

export default async function ProfilePage() {
  const t = await getTranslations("profile.empty");
  const initial = await getTheme();
  return (
    <div className="flex flex-col gap-8 px-5 py-8">
      <header>
        <h1 className="font-serif text-2xl font-medium text-forest">
          {t("title")}
        </h1>
        <p className="text-sm text-slate">{t("hint")}</p>
      </header>
      <ProfileThemeSelect initial={initial} />
    </div>
  );
}
