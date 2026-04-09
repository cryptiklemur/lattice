export function findDuplicateKeys(entries: Array<{ key: string }>): Set<string> {
  const seen = new Map<string, number>();
  const dupes = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const k = entries[i].key.trim();
    if (!k) continue;
    const count = (seen.get(k) || 0) + 1;
    seen.set(k, count);
    if (count > 1) dupes.add(k);
  }
  return dupes;
}
