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
