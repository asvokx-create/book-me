"use client";

import DatePicker from "@/components/date-picker";

export type DateRangeValue = { start: string; end: string };

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  startName?: string;
  endName?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  startClassName?: string;
  endClassName?: string;
};

/** A date-only range made from the same accessible branded calendar used across forms. */
export default function DateRangePicker({ value, onChange, startName, endName, required = false, disabled = false, ariaLabel, className = "", startClassName = "", endClassName = "" }: DateRangePickerProps) {
  return <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
    <DatePicker name={startName} required={required} disabled={disabled} value={value.start} onChange={(start) => onChange({ start, end: value.end && value.end < start ? "" : value.end })} ariaLabel={`${ariaLabel} start date`} placeholder="Start date" buttonClassName={startClassName} />
    <DatePicker name={endName} required={required} disabled={disabled} min={value.start || undefined} value={value.end} onChange={(end) => onChange({ start: value.start, end })} ariaLabel={`${ariaLabel} end date`} placeholder="End date" buttonClassName={endClassName} />
  </div>;
}
