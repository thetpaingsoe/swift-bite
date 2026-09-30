import type { Address } from "../api/addresses";

function keyFor(userId: string | null | undefined) {
  return `swiftbite:cached-addresses:${userId ?? "anonymous"}`;
}

export function loadCachedAddresses(userId: string | null | undefined): Address[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Address =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as Address).id === "string" &&
        typeof (a as Address).label === "string" &&
        typeof (a as Address).street === "string" &&
        typeof (a as Address).area === "string",
    );
  } catch {
    return [];
  }
}

export function saveCachedAddresses(
  userId: string | null | undefined,
  addresses: Address[],
) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(addresses));
  } catch {
    // storage full or unavailable — live data still renders
  }
}
