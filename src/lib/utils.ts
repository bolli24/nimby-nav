export const getOrInsertComputed = <K, V>(
  map: Map<K, V>,
  key: K,
  createValue: () => V,
): V => {
  if (!map.has(key)) {
    map.set(key, createValue());
  }

  return map.get(key)!;
};
