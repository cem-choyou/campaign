// Dates (§6.4): stored in UTC, displayed, typed and computed in the brand's time zone.
// Campaign start/end dates are date-only values (Postgres DATE → JS Date at UTC midnight).

import { addDays, differenceInCalendarDays, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "Europe/Paris";
export const DEFAULT_TIME = "09:00";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** "2026-10-05" → Date at UTC midnight (how Prisma represents a DATE column). */
export function parseDateOnly(value: string): Date {
  if (!isDateOnly(value)) throw new RangeError(`Invalid date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date at UTC midnight → "2026-10-05". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Local wall-clock date + time in `timeZone` → UTC instant. DST-safe. */
export function localToUtc(date: string, time: string, timeZone = DEFAULT_TIMEZONE): Date {
  if (!isDateOnly(date)) throw new RangeError(`Invalid date: ${date}`);
  if (!isTime(time)) throw new RangeError(`Invalid time: ${time}`);
  return fromZonedTime(`${date}T${time}:00`, timeZone);
}

/** UTC instant → local { date: "yyyy-MM-dd", time: "HH:mm" } in `timeZone`. */
export function toLocalParts(instant: Date, timeZone = DEFAULT_TIMEZONE) {
  return {
    date: formatInTimeZone(instant, timeZone, "yyyy-MM-dd"),
    time: formatInTimeZone(instant, timeZone, "HH:mm"),
  };
}

/**
 * Excel planning rule (§6.4): date = start Monday + (week − 1) × 7 + day offset, at the local
 * time of the brand, converted to UTC.
 */
export function fromWeekDay(
  startMonday: Date | string,
  week: number,
  dayOffset: number,
  time = DEFAULT_TIME,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  if (!Number.isInteger(week) || week < 1) throw new RangeError(`Invalid week: ${week}`);
  if (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 6) {
    throw new RangeError(`Invalid day offset: ${dayOffset}`);
  }
  const start = typeof startMonday === "string" ? parseDateOnly(startMonday) : startMonday;
  const day = addDays(start, (week - 1) * 7 + dayOffset);
  return localToUtc(formatDateOnly(day), time, timeZone);
}

/** Moves an instant by whole local days, keeping its local time (a 09:00 post stays at 09:00 across DST). */
export function shiftLocalDays(instant: Date, days: number, timeZone = DEFAULT_TIMEZONE): Date {
  const { date, time } = toLocalParts(instant, timeZone);
  return localToUtc(formatDateOnly(addDays(parseDateOnly(date), days)), time, timeZone);
}

/** Same local day, another local time. */
export function withLocalTime(instant: Date, time: string, timeZone = DEFAULT_TIMEZONE): Date {
  return localToUtc(toLocalParts(instant, timeZone).date, time, timeZone);
}

/** Moves an instant to another local day, keeping its local time (month-view drag and drop). */
export function withLocalDate(instant: Date, date: string, timeZone = DEFAULT_TIMEZONE): Date {
  return localToUtc(date, toLocalParts(instant, timeZone).time, timeZone);
}

// ---------- Display (French) ----------

/** "lun. 5 oct." */
export function formatDay(instant: Date, timeZone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(instant, timeZone, "EEE d MMM", { locale: fr });
}

/** "mercredi 7 octobre" */
export function formatDayLong(instant: Date, timeZone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(instant, timeZone, "EEEE d MMMM", { locale: fr });
}

/** "09:00" */
export function formatTime(instant: Date, timeZone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(instant, timeZone, "HH:mm");
}

/** "lun. 5 oct. · 09:00" */
export function formatDayTime(instant: Date, timeZone = DEFAULT_TIMEZONE): string {
  return `${formatDay(instant, timeZone)} · ${formatTime(instant, timeZone)}`;
}

/** Date-only campaign bounds: "5 oct. 2026". */
export function formatDateOnlyShort(date: Date): string {
  return formatInTimeZone(date, "UTC", "d MMM yyyy", { locale: fr });
}

/** Relative wording: "dans 2 h", "il y a 5 min", "hier à 09:00", "demain à 18:00", "lun. 5 oct.". */
export function formatRelative(
  instant: Date,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): string {
  const minutes = differenceInMinutes(instant, now);
  const abs = Math.abs(minutes);
  if (abs < 1) return "à l'instant";
  if (abs < 60) return minutes > 0 ? `dans ${abs} min` : `il y a ${abs} min`;
  if (abs < 6 * 60) {
    const hours = Math.round(abs / 60);
    return minutes > 0 ? `dans ${hours} h` : `il y a ${hours} h`;
  }
  const days = differenceInCalendarDays(
    parseDateOnly(toLocalParts(instant, timeZone).date),
    parseDateOnly(toLocalParts(now, timeZone).date),
  );
  const at = formatTime(instant, timeZone);
  if (days === 0) return `aujourd'hui à ${at}`;
  if (days === 1) return `demain à ${at}`;
  if (days === -1) return `hier à ${at}`;
  return formatDay(instant, timeZone);
}

/** Today's local date in the brand time zone ("yyyy-MM-dd"). */
export function todayLocal(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  return toLocalParts(now, timeZone).date;
}

/** Monday of the local week containing `date` ("yyyy-MM-dd"). */
export function mondayOf(date: string): string {
  const d = parseDateOnly(date);
  const offset = (d.getUTCDay() + 6) % 7;
  return formatDateOnly(addDays(d, -offset));
}
