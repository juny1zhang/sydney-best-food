import { RESTAURANTS } from '../data/restaurants';
import { buildIcs, escapeText, eventTimes, foldLine } from './ics';
import { planItems, setPick, setReservation } from './plan';

const lhf = RESTAURANTS.find((r) => r.id === 'lee-ho-fook')!;

function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

describe('ics', () => {
  it('converts Sydney and New Zealand December times to UTC', () => {
    // 19:00 AEDT (UTC+11) on 4 Dec is 08:00Z.
    expect(eventTimes(4, 'dinner', '19:00')).toEqual({ start: '20261204T080000Z', end: '20261204T100000Z' });
    // 19:30 NZDT (UTC+13) on 6 Dec is 06:30Z; lunch lasts 90 minutes.
    expect(eventTimes(6, 'dinner', '19:30').start).toBe('20261206T063000Z');
    expect(eventTimes(8, 'lunch', '12:30')).toEqual({ start: '20261207T233000Z', end: '20261208T010000Z' });
    // Days away from both are written as floating local times.
    expect(eventTimes(1, 'lunch', '12:00')).toEqual({ start: '20261201T120000', end: '20261201T133000' });
  });

  it('escapes text and folds long lines on character boundaries', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    // Text from the shared plan can't smuggle in extra lines or control characters.
    expect(escapeText('x\rEND:VEVENT\r\nY\u0000\u001b')).toBe('x\\nEND:VEVENT\\nY');
    const long = `DESCRIPTION:${'悉尼吃什么'.repeat(20)}`;
    const folded = foldLine(long);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('writes one event per meal with booking status', () => {
    let picks = setPick({}, 4, 'dinner', { kind: 'restaurant', id: lhf.id });
    picks = setPick(picks, 22, 'lunch', { kind: 'custom', name: '楼下, 面馆', note: '' });
    picks = setReservation(picks, 4, 'dinner', { time: '19:15', note: '订位号 88' });
    const ics = unfold(buildIcs(planItems(picks), new Date(Date.UTC(2026, 9, 17, 1, 2, 3))));

    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4); // two trip bookings + two picks
    expect(ics).toContain('UID:2026-12-04-dinner@sydney-eats');
    expect(ics).toContain('DTSTART:20261204T081500Z');
    expect(ics).toContain('SUMMARY:晚餐 · Lee Ho Fook Sydney\r\n');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('订位：订位号 88');
    expect(ics).toContain('SUMMARY:午餐 · 楼下\\, 面馆（未订位）');
    expect(ics).toContain('DTSTAMP:20261017T010200Z');
    expect(ics).toContain('SUMMARY:晚餐 · Advieh');
  });

  it('starts unbooked meals at times that fit the day', () => {
    // 18 Dec: dinner before the 20:15 penguin check-in, 17:00 NZDT = 04:00Z.
    const picks = setPick({}, 18, 'dinner', { kind: 'restaurant', id: 'nz-oamaru-cucina' });
    const ics = unfold(buildIcs(planItems(picks)));
    expect(ics).toContain('DTSTART:20261218T040000Z');
    expect(ics).toContain('SUMMARY:晚餐 · Cucina（未订位）');
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});
