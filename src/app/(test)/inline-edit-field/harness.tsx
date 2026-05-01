"use client";

import { useState } from "react";

import { InlineEditField } from "@shared/ui/inline-edit-field";

export function InlineEditFieldTestHarness() {
  const [name, setName] = useState("Manjericão");
  const [notes, setNotes] = useState("Planta aromática de verão.");
  const [acquiredDate, setAcquiredDate] = useState("2025-01-15");

  return (
    <main className="min-h-[100dvh] bg-paper p-6">
      <h1 className="mb-6 font-serif text-2xl text-forest">InlineEditField test harness</h1>

      <div className="flex flex-col gap-8 max-w-md">
        {/* Section A: text variant, always succeeds */}
        <section data-testid="inline-text-success">
          <h2 className="mb-2 font-semibold text-forest text-sm">Texto (sucesso)</h2>
          <InlineEditField
            label="Nome"
            value={name}
            placeholder="Sem nome"
            variant="text"
            onSave={async (v) => setName(v)}
          />
        </section>

        {/* Section B: textarea variant, always succeeds */}
        <section data-testid="inline-textarea-success">
          <h2 className="mb-2 font-semibold text-forest text-sm">Texto longo (sucesso)</h2>
          <InlineEditField
            label="Anotações"
            value={notes}
            placeholder="Adicionar anotações"
            variant="textarea"
            onSave={async (v) => setNotes(v)}
          />
        </section>

        {/* Section C: date variant, always succeeds */}
        <section data-testid="inline-date-success">
          <h2 className="mb-2 font-semibold text-forest text-sm">Data (sucesso)</h2>
          <InlineEditField
            label="Data de aquisição"
            value={acquiredDate}
            placeholder="Sem data"
            variant="date"
            onSave={async (v) => setAcquiredDate(v)}
          />
        </section>

        {/* Section D: text variant, always fails — used by E2E case 21 */}
        <section data-testid="inline-text-failure">
          <h2 className="mb-2 font-semibold text-forest text-sm">Texto (falha)</h2>
          <InlineEditField
            label="Campo com falha"
            value="Valor inicial"
            placeholder="Sem valor"
            variant="text"
            revertAnnouncementCopy="Não conseguimos salvar agora — tentar de novo?"
            onSave={() => Promise.reject(new Error("test"))}
          />
        </section>

        {/* Section E: read-only field */}
        <section data-testid="inline-text-readonly">
          <h2 className="mb-2 font-semibold text-forest text-sm">Somente leitura</h2>
          <InlineEditField
            label="Campo somente leitura"
            value="Não editável"
            placeholder="Sem valor"
            variant="text"
            readOnly
            onSave={async () => {}}
          />
        </section>
      </div>
    </main>
  );
}
