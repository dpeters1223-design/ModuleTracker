// "Today" and times in the team's time zone (APP_TIMEZONE, e.g. America/New_York),
// not the server's UTC clock — otherwise after 8 pm Eastern the app thinks it's
// already tomorrow. Server-only callers; pass results to the browser as strings.

export const appTimeZone = () => process.env.APP_TIMEZONE || "UTC";

/** Today's calendar date in the app's time zone, as "YYYY-MM-DD". */
export function todayInZone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone() }).format(new Date());
}

/** A moment formatted for display in the app's time zone, e.g. "2:14 PM". */
export function timeInZone(d: Date): string {
  return d.toLocaleTimeString("en-US", { timeZone: appTimeZone(), hour: "numeric", minute: "2-digit" });
}

/** The calendar date of a moment in the app's time zone, as "YYYY-MM-DD". */
export function dayInZone(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone() }).format(d);
}

/** The hour right now in the app's time zone, 0-23. en-GB gives "00"-"23" rather than "24". */
export function hourInZone(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: appTimeZone(), hour: "2-digit", hour12: false }).format(new Date())
  );
}

/** "2026-10-27" + 1 → "2026-10-28". Anchored at noon so no DST shift moves the day. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The Date a calendar day is stored as: noon UTC, matching how due dates are written. */
export function noonUtc(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}
