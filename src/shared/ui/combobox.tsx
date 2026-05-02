"use client";

import { useId, useRef, useState, useEffect } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  options: ComboboxOption[];
  ghostRowTemplate?: string | null;
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  "data-testid"?: string;
  disabled?: boolean;
}

export function Combobox({
  label,
  placeholder,
  value,
  onChange,
  options,
  ghostRowTemplate,
  id,
  name,
  "aria-describedby": ariaDescribedby,
  "data-testid": dataTestId,
  disabled,
}: ComboboxProps) {
  const reactId = useId();
  const inputId = id ?? `combobox-${reactId}`;
  const listboxId = `${inputId}-listbox`;
  const labelId = `${inputId}-label`;

  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState<ComboboxOption[]>(options);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // WR-08: outside click closes the listbox (APG combobox guidance).
  // Listens at the document level only while open to avoid leaking a
  // listener when the listbox is collapsed.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current && containerRef.current.contains(target)) return;
      setOpen(false);
      setHighlightIndex(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const GHOST_VALUE_PREFIX = "__ghost__";

  function computeGhostRow(q: string, opts: ComboboxOption[]): ComboboxOption | null {
    if (!ghostRowTemplate || !q.trim()) return null;
    const exactMatch = opts.some((o) => o.label.toLowerCase() === q.toLowerCase());
    if (exactMatch) return null;
    const ghostLabel = ghostRowTemplate.replace("{typed}", q);
    return { value: `${GHOST_VALUE_PREFIX}${q}`, label: ghostLabel };
  }

  function buildVisible(q: string, baseOptions: ComboboxOption[]): ComboboxOption[] {
    const filtered = q
      ? baseOptions.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
      : baseOptions;
    const ghost = computeGhostRow(q, filtered);
    return ghost ? [ghost, ...filtered] : filtered;
  }

  const visibleOptions = buildVisible(query, filteredOptions);

  function openListbox() {
    if (disabled) return;
    setOpen(true);
  }

  function closeListbox() {
    setOpen(false);
    setHighlightIndex(null);
  }

  function commitOption(opt: ComboboxOption) {
    const committedValue = opt.value.startsWith(GHOST_VALUE_PREFIX)
      ? opt.value.slice(GHOST_VALUE_PREFIX.length)
      : opt.value;
    onChange(committedValue);
    setQuery("");
    setFilteredOptions(options);
    closeListbox();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!open) {
          openListbox();
          setHighlightIndex(0);
        } else {
          setHighlightIndex((prev) => {
            if (prev === null) return 0;
            return prev >= visibleOptions.length - 1 ? 0 : prev + 1;
          });
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!open) {
          openListbox();
          setHighlightIndex(visibleOptions.length > 0 ? visibleOptions.length - 1 : null);
        } else {
          setHighlightIndex((prev) => {
            if (prev === null || prev === 0)
              return visibleOptions.length > 0 ? visibleOptions.length - 1 : null;
            return prev - 1;
          });
        }
        break;
      }
      case "Home": {
        if (open) {
          e.preventDefault();
          setHighlightIndex(visibleOptions.length > 0 ? 0 : null);
        }
        break;
      }
      case "End": {
        if (open) {
          e.preventDefault();
          setHighlightIndex(visibleOptions.length > 0 ? visibleOptions.length - 1 : null);
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (open && highlightIndex !== null && visibleOptions[highlightIndex]) {
          commitOption(visibleOptions[highlightIndex]);
        }
        break;
      }
      case "Escape": {
        e.preventDefault();
        if (open) {
          closeListbox();
        } else {
          onChange("");
          setQuery("");
          setFilteredOptions(options);
        }
        break;
      }
      case "Tab": {
        closeListbox();
        break;
      }
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);

    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const filtered = q
        ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
        : options;
      setFilteredOptions(filtered);
      setHighlightIndex(null);
      debounceRef.current = null;
    }, 100);

    if (!open && !disabled) {
      setOpen(true);
    }
  }

  const activedescendant =
    open && highlightIndex !== null && visibleOptions[highlightIndex]
      ? `${listboxId}-${visibleOptions[highlightIndex].value}`
      : undefined;

  const displayValue = open ? query : value;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span id={labelId} className="text-sm font-semibold text-forest">
        {label}
      </span>
      <input
        role="combobox"
        id={inputId}
        name={name}
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value && !query) {
            setQuery(value);
          }
        }}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={activedescendant}
        aria-autocomplete="list"
        aria-labelledby={labelId}
        aria-describedby={ariaDescribedby}
        data-testid={dataTestId}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className="
          min-h-[48px] rounded-lg border-[1.5px] border-hairline bg-ivory px-4
          py-3 text-base text-forest outline-none
          focus:border-canopy
        "
      />
      {open && visibleOptions.length > 0 ? (
        <ul
          role="listbox"
          id={listboxId}
          aria-labelledby={labelId}
          className="
            absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto
            rounded-lg border border-hairline bg-ivory shadow-md
          "
        >
          {visibleOptions.map((opt, index) => {
            const optId = `${listboxId}-${opt.value}`;
            const isHighlighted = highlightIndex === index;
            const isSelected = opt.value === value;
            return (
              <li
                key={optId}
                id={optId}
                role="option"
                aria-selected={isSelected}
                data-highlighted={isHighlighted ? "true" : undefined}
                className={`
                  cursor-pointer px-4 py-3 text-base text-forest
                  ${isHighlighted ? `bg-hairline` : ""}
                `}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitOption(opt);
                }}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
