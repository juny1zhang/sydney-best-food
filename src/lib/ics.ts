import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import { mapsSearchUrl, mapsUrl } from '../data/restaurants';
import type { Meal } from '../data/types';
import { MEALS, entryName, isReserved, mealLabel, reservedTime, type PlanItem } from './plan';

/**
 * UTC offsets for December 2026: Sydney is on AEDT (UTC+11) from 4 Oct 2026 to 4 Apr 2027,
 * New Zealand on NZDT (UTC+13) from 27 Sep 2026 to 4 Apr 2027.
 */
const OFFSET_MINUTES = { syd: 11 * 60, nz: 13 * 60 } as const;
const DURATION_MINUTES: Record<Meal, number> = { lunch: 90, dinner: 120 };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function stamp(d: Date, utc: boolean): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00${utc ? 'Z' : ''}`;
}

/**
 * Start and end of a meal. Sydney and New Zealand days get exact UTC times; days elsewhere
 * (travel, unplanned) are written as floating local times.
 */
export function eventTimes(day: number, meal: Meal, time: string): { start: string; end: string } {
  const [h, m] = time.split(':').map(Number);
  const region = dayInfo(day).region;
  const zone = region === 'syd' || region === 'nz' ? region : null;
  const localMs = Date.UTC(YEAR, MONTH_INDEX, day, h, m);
  const startMs = zone ? localMs - OFFSET_MINUTES[zone] * 60_000 : localMs;
  const endMs = startMs + DURATION_MINUTES[meal] * 60_000;
  return { start: stamp(new Date(startMs), !!zone), end: stamp(new Date(endMs), !!zone) };
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Folds a content line at 75 octets (RFC 5545 §3.1) without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length ? 74 : 75; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function eventLines(item: PlanItem, now: Date): string[] {
  const { day, meal, entry } = item;
  const reserved = isReserved(entry);
  const time = reservedTime(entry) ?? MEALS.find((m) => m.key === meal)!.defaultTime;
  const { start, end } = eventTimes(day, meal, time);
  const name = entryName(entry);

  let location = '';
  let url = '';
  const details: string[] = [];
  if (entry.status === 'booked') {
    const v = entry.booking.venue;
    location = `${v.name}, ${v.address}`;
    url = v.website || mapsUrl(v.name, v.address);
    details.push(`${v.categoryLabel} · ${v.price}`, v.intro, entry.booking.note);
  } else if (entry.status === 'picked') {
    const p = entry.place;
    location = `${p.name}, ${p.address}`;
    url = p.website || mapsSearchUrl(p.mapsQuery);
    details.push(`${p.categoryLabel} · ${p.area} · ${p.price}`, p.intro);
    details.push(reserved ? `订位：${entry.reserved?.note || '已订好'}` : `还没订位。订位提示：${p.booking}`);
  } else {
    location = name;
    if (entry.pick.note) details.push(entry.pick.note);
    details.push(reserved ? `订位：${entry.reserved?.note || '已订好'}` : '还没订位');
  }

  const lines = [
    'BEGIN:VEVENT',
    `UID:${YEAR}-${pad(MONTH_INDEX + 1)}-${pad(day)}-${meal}@sydney-eats`,
    `DTSTAMP:${stamp(now, true)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(`${mealLabel(meal)} · ${name}${reserved ? '' : '（未订位）'}`)}`,
    `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${escapeText(details.filter(Boolean).join('\n'))}`,
    `STATUS:${reserved ? 'CONFIRMED' : 'TENTATIVE'}`,
  ];
  if (url) lines.push(`URL:${url}`);
  lines.push('END:VEVENT');
  return lines;
}

/** An iCalendar file with one event per planned meal. */
export function buildIcs(items: PlanItem[], now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sydney Eats//December 2026//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText('悉尼吃什么 · 十二月')}`,
    ...items.flatMap((item) => eventLines(item, now)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export const ICS_FILENAME = 'sydney-eats-2026-12.ics';

/** Saves the plan as an .ics file the phone or computer calendar can import. */
export function downloadIcs(items: PlanItem[]): void {
  const blob = new Blob([buildIcs(items)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ICS_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
