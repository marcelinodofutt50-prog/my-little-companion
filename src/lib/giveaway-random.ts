import { containsPrivateData } from "./privacy-patterns";

export function publicGiveawayLabel(label: string | null): string {
  const value = (label ?? "").trim();
  return !value || containsPrivateData(value) ? "Membro Shadow" : Array.from(value).slice(0, 24).join("");
}

/** Rejection sampling avoids the bias introduced by uint32 modulo. */
export function randomIndex(length: number, next = () => crypto.getRandomValues(new Uint32Array(1))[0]): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) throw new Error("Invalid pool size");
  const ceiling = Math.floor(0x100000000 / length) * length;
  let value = next();
  while (value >= ceiling) value = next();
  return value % length;
}

export function shuffledSample<T>(items: T[], limit = 40): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit);
}