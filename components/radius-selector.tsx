"use client";

import { useState } from "react";
import CustomSelect from "@/components/custom-select";

const PRESET_RADII = [5, 10, 25, 50, 100, 250];
const RADIUS_OPTIONS = [...PRESET_RADII.map((radius) => ({ value: String(radius), label: `${radius} mi` })), { value: "custom", label: "Custom…" }];

type RadiusSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  name?: string;
  compact?: boolean;
};

export default function RadiusSelector({ value, onChange, name, compact = false }: RadiusSelectorProps) {
  const [custom, setCustom] = useState(!PRESET_RADII.includes(value));

  const normalizedValue = Number.isFinite(value) ? value : 25;
  const selectClass = compact
    ? "compact-radius-select min-h-10 bg-transparent font-semibold"
    : "min-h-12 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 text-sm transition focus-within:border-[#4d725d] focus-within:ring-2 focus-within:ring-[#4d725d]/10";

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <CustomSelect
        ariaLabel="Radius options"
        value={custom ? "custom" : String(normalizedValue)}
        options={RADIUS_OPTIONS}
        onChange={(nextValue) => {
          if (nextValue === "custom") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(Number(nextValue));
        }}
        className={compact ? "min-w-0" : "w-full"}
        buttonClassName={selectClass}
        menuClassName={compact ? "w-36" : ""}
      />
      {custom ? (
        <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2"}>
          <input
            aria-label="Custom radius in miles"
            name={name}
            type="number"
            min={1}
            max={250}
            step={1}
            required
            value={normalizedValue}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => onChange(Number(event.target.value))}
            className={compact ? "w-16 rounded-lg border border-[#183126]/15 bg-white px-2 py-1.5 text-sm font-semibold outline-none focus:border-[#4d725d]" : "w-28 rounded-xl border border-[#183126]/15 bg-[#faf9f5] px-3 py-3 text-sm outline-none focus:border-[#4d725d]"}
          />
          <span className="whitespace-nowrap text-xs text-[#718078]">miles</span>
        </div>
      ) : name ? <input type="hidden" name={name} value={normalizedValue} /> : null}
    </div>
  );
}
