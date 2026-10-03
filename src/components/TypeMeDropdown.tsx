import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface TypeMeDropdownOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

interface TypeMeDropdownProps<T extends string> {
  value: T;
  options: TypeMeDropdownOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * The single reusable TypeMe dropdown (replaces native <select> so the UI
 * never shows browser-default controls). Custom popover with outside-click
 * + Escape dismissal, arrow-key navigation, aria roles, and 44px targets.
 * Anchored right so it cannot overflow the viewport horizontally.
 */
export function TypeMeDropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: TypeMeDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const onListKey = (e: React.KeyboardEvent) => {
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length].value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length].value);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-2xs transition-colors hover:border-neutral-300"
      >
        <span>{active?.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onListKey}
          className="absolute right-0 z-50 mt-1 max-h-64 w-52 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-xs transition-colors ${
                  selected
                    ? "bg-neutral-900 font-semibold text-white"
                    : "font-medium text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span>
                  {o.label}
                  {o.hint ? (
                    <span className={`block text-[10px] font-normal ${selected ? "text-neutral-300" : "text-neutral-400"}`}>
                      {o.hint}
                    </span>
                  ) : null}
                </span>
                {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
