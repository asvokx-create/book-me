"use client";

import { useId, useMemo, useRef, useState } from "react";
import { getServiceCategorySearchMatches, SERVICE_CATEGORY_ICONS, SERVICE_SEARCH_ALIASES } from "@/lib/service-categories";

type ServiceSearchAssistProps = {
  id: string;
  defaultValue?: string;
  placeholder: string;
  label?: string;
  className?: string;
  inputClassName?: string;
  icon?: string;
  iconClassName?: string;
};

function suggestionHint(category: ReturnType<typeof getServiceCategorySearchMatches>[number], query: string) {
  const normalized = query.trim().toLowerCase();
  const alias = SERVICE_SEARCH_ALIASES[category]?.find((term) => term.toLowerCase().includes(normalized));
  return alias ? `Related: ${alias}` : `Browse ${category.toLowerCase()}`;
}

export default function ServiceSearchAssist({ id, defaultValue = "", placeholder, label = "Service to search for", className = "", inputClassName = "", icon = "⌕", iconClassName = "" }: ServiceSearchAssistProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(() => getServiceCategorySearchMatches(query).slice(0, 6), [query]);
  const visible = open && query.trim().length >= 2 && suggestions.length > 0;

  function choose(category: string) {
    setQuery(category);
    setOpen(false);
    setActiveIndex(-1);
    window.setTimeout(() => inputRef.current?.form?.requestSubmit(), 0);
  }

  return <div className={`relative ${className}`} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <span className={iconClassName} aria-hidden="true">{icon}</span>
    <label htmlFor={id} className="sr-only">{label}</label>
    <input
      ref={inputRef}
      id={id}
      name="q"
      type="search"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={visible}
      aria-controls={visible ? listboxId : undefined}
      aria-activedescendant={visible && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
      autoComplete="off"
      value={query}
      placeholder={placeholder}
      className={inputClassName}
      onFocus={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(-1); }}
      onKeyDown={(event) => {
        if (!visible && event.key === "ArrowDown" && suggestions.length) {
          event.preventDefault(); setOpen(true); setActiveIndex(0); return;
        }
        if (!visible) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => (current + 1) % suggestions.length); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1); }
        else if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); choose(suggestions[activeIndex]); }
        else if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActiveIndex(-1); }
      }}
    />
    {visible && <div id={listboxId} role="listbox" aria-label="Suggested services" className="absolute inset-x-0 top-[calc(100%+.55rem)] z-[100] overflow-hidden rounded-2xl border border-[#183126]/10 bg-white p-2 shadow-[0_20px_55px_rgba(24,49,38,.2)]">
      <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[.13em] text-[#718078]">Suggested services</p>
      {suggestions.map((category, index) => <button
        id={`${listboxId}-${index}`}
        key={category}
        type="button"
        role="option"
        aria-selected={activeIndex === index}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(category)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${activeIndex === index ? "bg-[#e8f1e5]" : "hover:bg-[#f1f4ed]"}`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf3e9] text-lg" aria-hidden="true">{SERVICE_CATEGORY_ICONS[category] ?? "✨"}</span>
        <span className="min-w-0"><span className="block font-bold text-[#183126]">{category}</span><span className="block truncate text-xs text-[#718078]">{suggestionHint(category, query)}</span></span>
      </button>)}
    </div>}
  </div>;
}
