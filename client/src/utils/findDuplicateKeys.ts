export function findDuplicateKeys(entries: Array<{ key: string }>): Set<string> {
  var seen = new Map<string, number>();
  var dupes = new Set<string>();
  for (var i = 0; i < entries.length; i++) {
    var k = entries[i].key.trim();
    if (!k) continue;
    var count = (seen.get(k) || 0) + 1;
    seen.set(k, count);
    if (count > 1) dupes.add(k);
  }
  return dupes;
}
