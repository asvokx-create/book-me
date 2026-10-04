export function publicPersonalName(personalName: string | null | undefined, visible: boolean) {
  if (!visible) return null;
  const normalized = personalName?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}
