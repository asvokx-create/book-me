export const ALL_DAY_START_TIME = "00:00";
export const ALL_DAY_END_TIME = "23:59";

export function isAllDayAvailability(startTime: string, endTime: string) {
  return startTime.slice(0, 5) === ALL_DAY_START_TIME && endTime.slice(0, 5) === ALL_DAY_END_TIME;
}
