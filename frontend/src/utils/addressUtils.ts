/**
 * Resolves a full address string to an alias if one exists,
 * otherwise returns the first segment (street) of the address.
 */
export function resolveAddress(
  full: string | undefined | null,
  aliases: Record<string, string> | undefined,
): string {
  if (!full) return '–';
  if (aliases) {
    // Exact match
    if (aliases[full]) return aliases[full];
    // Partial match: address starts with an alias key (handles trailing city/country variations)
    for (const key of Object.keys(aliases)) {
      if (full.startsWith(key) || key.startsWith(full.split(',')[0])) {
        return aliases[key];
      }
    }
  }
  return full.split(',')[0];
}
