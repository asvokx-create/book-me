const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})$/;

export function isValidTimeZone(timeZone: string) {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const dateMatch = date.match(datePattern);
  const timeMatch = time.match(timePattern);
  if (!dateMatch || !timeMatch || !isValidTimeZone(timeZone)) return null;

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };
  if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31 || target.hour > 23 || target.minute > 59) return null;

  const wallClockUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, 0);
  const normalized = new Date(wallClockUtc);
  if (normalized.getUTCFullYear() !== target.year || normalized.getUTCMonth() + 1 !== target.month || normalized.getUTCDate() !== target.day) return null;

  let result = new Date(wallClockUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const displayed = zonedParts(result, timeZone);
    const displayedAsUtc = Date.UTC(displayed.year, displayed.month - 1, displayed.day, displayed.hour, displayed.minute, displayed.second);
    result = new Date(result.getTime() + (wallClockUtc - displayedAsUtc));
  }

  const verified = zonedParts(result, timeZone);
  return verified.year === target.year && verified.month === target.month && verified.day === target.day
    && verified.hour === target.hour && verified.minute === target.minute
    ? result
    : null;
}
