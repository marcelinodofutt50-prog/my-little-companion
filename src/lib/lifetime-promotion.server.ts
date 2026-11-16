const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const brasilia = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function lifetimePromotionWindow(now = Date.now()) {
  const parts = Object.fromEntries(brasilia.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  // A data local escolhe o mesmo minuto em todas as instâncias.
  let hash = 2166136261;
  for (const char of date) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const startMinute = 13 * 60 + (hash >>> 0) % 181;
  const elapsed = Number(parts.hour) * HOUR_MS + Number(parts.minute) * MINUTE_MS +
    Number(parts.second) * 1000 + now % 1000;
  const startsAt = now - elapsed + startMinute * MINUTE_MS;
  const endsAt = startsAt + HOUR_MS;
  return { startsAt, endsAt, active: now >= startsAt && now < endsAt };
}
