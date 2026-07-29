// Port of the office open/closed logic from http/views/layouts/new.html (the
// `opens.de` / `opens.ny` / `opens.tb` CFML block). Same weekday/hour rules and
// timezones, computed client-side with Intl instead of server-side CFML.
export type OfficeId = "tbilisi" | "newyork" | "delaware";

const TIMEZONES: Record<OfficeId, string> = {
  tbilisi: "Asia/Tbilisi",
  newyork: "America/New_York",
  delaware: "America/New_York",
};

function partsFor(timeZone: string, date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(date),
  );
  return { isWeekend: weekday === "Sat" || weekday === "Sun", hour };
}

export function isOfficeOpen(office: OfficeId, date: Date = new Date()): boolean {
  const { isWeekend, hour } = partsFor(TIMEZONES[office], date);

  switch (office) {
    case "delaware":
      return !isWeekend && hour >= 9 && hour < 19;
    case "newyork":
      return isWeekend ? hour >= 10 && hour < 17 : hour >= 9 && hour < 19;
    case "tbilisi":
      return isWeekend ? hour >= 11 && hour < 17 : hour >= 11 && hour < 19;
  }
}
