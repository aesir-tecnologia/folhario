"use client";

import { useState } from "react";
import { Combobox } from "@shared/ui/combobox";
import { LocationCombobox } from "@shared/ui/location-combobox";

export function ComboboxTestHarness() {
  const [genericValue, setGenericValue] = useState("");
  const [locationValue, setLocationValue] = useState("");

  return (
    <main className="flex min-h-dvh flex-col gap-8 bg-paper p-6">
      <h1 className="font-serif text-2xl font-medium text-forest">Combobox test harness</h1>

      <section className="flex flex-col gap-2">
        <Combobox
          label="Genérico"
          placeholder="Selecione ou escreva…"
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
            { value: "c", label: "Gamma" },
          ]}
          ghostRowTemplate="Adicionar '{typed}'"
          value={genericValue}
          onChange={setGenericValue}
          data-testid="combobox-generic-input"
        />
      </section>

      <section className="flex flex-col gap-2">
        <LocationCombobox
          label="Localização"
          suggestions={["Sala da Mãe", "Quintal"]}
          value={locationValue}
          onChange={setLocationValue}
          data-testid="location-combobox-input"
        />
      </section>
    </main>
  );
}
