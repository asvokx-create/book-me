"use client";

import DatePicker from "@/components/date-picker";
import TimePicker from "@/components/time-picker";

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  className?: string;
  dateClassName?: string;
  timeClassName?: string;
  description?: string;
};

export default function DateTimePicker({ value, onChange, ariaLabel, required = false, disabled = false, minDate, className = "", dateClassName = "", timeClassName = "", description }: DateTimePickerProps) {
  const [date = "", time = ""] = value.split("T");
  function setDate(nextDate: string) { onChange(nextDate && time ? `${nextDate}T${time}` : nextDate); }
  function setTime(nextTime: string) { onChange(date && nextTime ? `${date}T${nextTime}` : nextTime); }
  return <div className={`grid gap-2 sm:grid-cols-2 ${className}`}><DatePicker value={date} onChange={setDate} required={required} disabled={disabled} min={minDate} ariaLabel={`${ariaLabel} date`} placeholder="Select date" buttonClassName={dateClassName} description={description} /><TimePicker value={time} onChange={setTime} required={required} disabled={disabled} ariaLabel={`${ariaLabel} time`} buttonClassName={timeClassName} /></div>;
}
