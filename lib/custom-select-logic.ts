export type SelectLogicOption = {
  disabled?: boolean;
  textValue?: string;
  description?: string;
};

export function nextEnabledIndex(options: readonly SelectLogicOption[], current: number, direction: 1 | -1) {
  if (!options.length) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (current + direction * offset + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return current;
}

export function edgeEnabledIndex(options: readonly SelectLogicOption[], fromEnd = false) {
  if (fromEnd) {
    for (let index = options.length - 1; index >= 0; index -= 1) if (!options[index]?.disabled) return index;
  } else {
    for (let index = 0; index < options.length; index += 1) if (!options[index]?.disabled) return index;
  }
  return -1;
}

export function filterSelectOptions<T extends SelectLogicOption>(options: readonly T[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...options];
  return options.filter((option) => `${option.textValue ?? ""} ${option.description ?? ""}`.toLocaleLowerCase().includes(normalized));
}
