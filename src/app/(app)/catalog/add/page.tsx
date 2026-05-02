import { getTranslations } from "next-intl/server";

import { AddPlantForm } from "./add-plant-form";

export default async function AddPlantPage() {
  const t = await getTranslations("catalog.add");

  const readOnly = process.env.ENABLE_TEST_ROUTES === "1" ? false : false;

  const labels = {
    title: t("title"),
    photoLabel: t("fields.photo.label"),
    photoPlaceholder: t("fields.photo.placeholder"),
    photoReplace: t("fields.photo.replace"),
    name: t("fields.name.label"),
    namePlaceholder: t("fields.name.placeholder"),
    nickname: t("fields.nickname.label"),
    nicknamePlaceholder: t("fields.nickname.placeholder"),
    location: t("fields.location.label"),
    acquisitionDate: t("fields.acquisitionDate.label"),
    notes: t("fields.notes.label"),
    notesPlaceholder: t("fields.notes.placeholder"),
    submit: t("submit"),
    submitLoading: t("submitLoading"),
    submitFailure: t("submitFailure"),
    errors: {
      nameRequired: t("errors.nameRequired"),
      photoRequired: t("errors.photoRequired"),
      acquisitionDateInvalid: t("errors.acquisitionDateInvalid"),
      summaryHeader: t("errors.summaryHeader", { fields: "{fields}" }),
    },
    fieldNames: {
      name: t("fields.name.label"),
      photo: t("fields.photo.label"),
      acquisitionDate: t("fields.acquisitionDate.label"),
    },
  };

  return (
    <div className="mx-auto max-w-[480px] pb-safe-bottom">
      <AddPlantForm readOnly={readOnly} labels={labels} initialLocationSuggestions={[]} />
    </div>
  );
}
