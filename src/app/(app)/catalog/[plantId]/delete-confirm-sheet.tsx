"use client";

import { useTranslations } from "next-intl";

import { BottomSheet } from "@shared/ui/bottom-sheet";

export interface DeleteConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantNameOrNickname: string;
  photoEntryCount: number;
  reminderCount: number;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
}

export function DeleteConfirmSheet(props: DeleteConfirmSheetProps) {
  const t = useTranslations("catalog.profile.delete");

  const bothPositive = props.photoEntryCount > 0 && props.reminderCount > 0;
  const onlyPhotos = props.photoEntryCount > 0 && props.reminderCount === 0;
  const onlyReminders = props.photoEntryCount === 0 && props.reminderCount > 0;

  const bodyKey = bothPositive
    ? "bodyBoth"
    : onlyPhotos
      ? "bodyPhotosOnly"
      : onlyReminders
        ? "bodyRemindersOnly"
        : "bodyEmpty";

  const bodyValues = bothPositive
    ? { photoCount: props.photoEntryCount, reminderCount: props.reminderCount }
    : onlyPhotos
      ? { photoCount: props.photoEntryCount }
      : onlyReminders
        ? { reminderCount: props.reminderCount }
        : {};

  return (
    <BottomSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      role="alertdialog"
      title={t("title", { nameOrNickname: props.plantNameOrNickname })}
      closeLabel={t("cancel")}
    >
      <p className="text-base/6 text-slate">
        {t(bodyKey, bodyValues as Record<string, string | number | Date>)}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {/* Cancelar BEFORE Excluir in DOM — PRD §17 destructive layout-secondary rule */}
        <button
          type="button"
          data-autofocus="true"
          data-testid="delete-confirm-cancel"
          onClick={() => props.onOpenChange(false)}
          className="
            flex min-h-[44px] w-full items-center justify-center rounded-xl
            border-2 border-canopy bg-transparent px-4 py-2.5 font-semibold
            text-canopy
            hover:bg-canopy/10
          "
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          data-testid="delete-confirm-confirm"
          disabled={props.isDeleting}
          onClick={() => {
            void props.onConfirm();
          }}
          className="
            flex min-h-[44px] w-full items-center justify-center rounded-xl
            bg-rust px-4 py-2.5 font-semibold text-ivory
            hover:bg-rust/90
            disabled:opacity-60
          "
        >
          {props.isDeleting ? t("deleting") : t("confirm")}
        </button>
      </div>
    </BottomSheet>
  );
}
