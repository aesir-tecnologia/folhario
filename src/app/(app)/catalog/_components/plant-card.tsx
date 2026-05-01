"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPinIcon } from "lucide-react";

export interface PlantCardProps {
  plant: {
    id: string;
    name: string;
    nickname: string | null;
    location: string | null;
    cover_signed_url: string | null;
  };
}

export function PlantCard({ plant }: PlantCardProps) {
  return (
    <Link
      href={`/catalog/${plant.id}`}
      className="
        block overflow-hidden rounded-2xl bg-ivory
        shadow-[0_2px_12px_rgba(20,52,36,0.06)] transition-transform
        duration-150
        active:scale-[0.985]
        motion-reduce:active:scale-100 motion-reduce:active:opacity-90
      "
    >
      <div className="relative aspect-4/5 w-full bg-hairline">
        {plant.cover_signed_url ? (
          <Image
            src={plant.cover_signed_url}
            alt={`Foto de ${plant.nickname || plant.name}`}
            fill
            sizes="(min-width:900px) 25vw, (min-width:600px) 33vw, 50vw"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h3 className="truncate font-sans text-base/6 font-semibold text-forest">
          {plant.name}
        </h3>
        {plant.nickname ? (
          <p className="truncate font-sans text-sm/5 font-normal text-slate">
            {plant.nickname}
          </p>
        ) : null}
        {plant.location ? (
          <p className="
            flex items-center gap-1 truncate font-sans text-sm/5 font-normal
            text-slate
          ">
            <MapPinIcon size={14} strokeWidth={1.5} aria-hidden />
            <span className="truncate">{plant.location}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
