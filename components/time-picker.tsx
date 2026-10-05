"use client";

import { useMemo } from "react";
import CustomSelect from "@/components/custom-select";
import UiIcon from "@/components/ui-icon";

type TimePickerProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  minuteStep?: number;
  description?: string;
};

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2026, 0, 1, hours, minutes));
}

export default function TimePicker({ value, defaultValue = "", onChange, name, required, disabled, ariaLabel, className = "", buttonClassName = "", minuteStep = 15, description }: TimePickerProps) {
  const options = useMemo(() => {
    const entries = Array.from({ length: Math.ceil((24 * 60) / minuteStep) }, (_, index) => {
      const minutes = index * minuteStep;
      const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      return { value, label: formatTime(value), textValue: `${formatTime(value)} ${value}` };
    });
    const existing = value ?? defaultValue ?? "";
    return existing && !entries.some((entry) => entry.value === existing) ? [{ value: existing, label: formatTime(existing), textValue: `${formatTime(existing)} ${existing}` }, ...entries] : entries;
  }, [defaultValue, minuteStep, value]);
  return <div className={`time-picker relative ${className}`}><CustomSelect value={value} defaultValue={defaultValue} onChange={onChange} name={name} required={required} disabled={disabled} ariaLabel={ariaLabel} searchable={options.length > 80} options={options} placeholder="Select a time" description={description} renderValue={(option) => <span className="flex items-center gap-2"><UiIcon name="clock" className="h-4 w-4 shrink-0 text-[#52705e]" />{option.label}</span>} buttonClassName={`min-h-12 ${buttonClassName}`} /></div>;
}
