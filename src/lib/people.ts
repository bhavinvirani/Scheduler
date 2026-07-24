/** Normalize a person's name for comparison: trimmed and lowercased. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** The normalized names that more than one person shares (blank names ignored). */
export function duplicateNameKeys(names: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const key = normalizeName(raw);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [key, count] of counts) if (count > 1) duplicates.add(key);
  return duplicates;
}
