export interface TimestampedMemoryRecord {
  updatedAt: number;
}

export function mergeNewerMemoryRecords<T extends TimestampedMemoryRecord>(
  target: Map<string, T>,
  source: Iterable<[string, T]>,
  clone: (record: T) => T
): number {
  let mergedCount = 0;
  for (const [key, record] of source) {
    const current = target.get(key);
    if (!current || record.updatedAt > current.updatedAt) {
      target.set(key, clone(record));
      mergedCount += 1;
    }
  }
  return mergedCount;
}
