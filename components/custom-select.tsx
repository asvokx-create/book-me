"use client";

import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from "react";

export type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  options: readonly CustomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  renderValue?: (option: CustomSelectOption) => ReactNode;
};

export default function CustomSelect({ value, options, onChange, ariaLabel, className = "", buttonClassName = "", menuClassName = "", renderValue }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setOpen(true);
      if (event.key === "Home") setActiveIndex(0);
      else if (event.key === "End") setActiveIndex(options.length - 1);
      else setActiveIndex((current) => {
        const startingIndex = open ? current : selectedIndex;
        return event.key === "ArrowDown" ? (startingIndex + 1) % options.length : (startingIndex - 1 + options.length) % options.length;
      });
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div ref={rootRef} className={`custom-select relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (!open) setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
        className={`custom-select-trigger flex w-full min-w-0 items-center justify-between gap-2 text-left outline-none ${buttonClassName}`}
      >
        <span className="min-w-0 truncate">{renderValue && selected ? renderValue(selected) : selected?.label}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" /></svg>
      </button>
      {open && (
        <div id={listboxId} role="listbox" aria-label={ariaLabel} className={`custom-select-menu absolute left-0 top-full z-[90] mt-2 min-w-full overflow-hidden rounded-2xl border border-[#183126]/12 bg-white p-1.5 shadow-[0_18px_45px_rgba(24,49,38,.2)] ${menuClassName}`}>
          {options.map((option, index) => (
            <button
              id={`${listboxId}-${index}`}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
              className={`custom-select-option flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${option.value === value ? "bg-[#e5efe3] text-[#173d2e]" : activeIndex === index ? "bg-[#f2f5ef]" : "hover:bg-[#f2f5ef]"}`}
            >
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.value === value && <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="ml-3 h-4 w-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
