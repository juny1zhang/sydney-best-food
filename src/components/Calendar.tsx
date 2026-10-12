import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import { categoryOf } from '../data/restaurants';
import type { Meal } from '../data/types';
import { WEEK_HEADERS, dateLabel, monthGrid } from '../lib/calendar';
import { MEALS, mealEntry, type MealEntry, type Picks } from '../lib/plan';

type CellLook = 'plain' | 'nz' | 'travel' | 'picked' | 'booked';

export function entryName(e: MealEntry): string {
  if (e.status === 'booked') return e.booking.venue.name;
  if (e.status === 'picked') return e.restaurant.name;
  return e.pick.name;
}

function entryCategory(e: MealEntry): string {
  if (e.status === 'booked') return e.booking.venue.categoryLabel;
  if (e.status === 'picked') return categoryOf(e.restaurant.category).short;
  return '自己记的';
}

function entryStatus(e: MealEntry): string {
  return e.status === 'booked' ? `已预订 ${e.booking.time}` : '已选好';
}

/** The calendar button for a day, used to put focus back on the calendar. */
export function dayCellElement(day: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.cell[data-day="${day}"]`);
}

interface GridProps {
  picks: Picks;
  selected: number;
  onSelect: (day: number) => void;
}

export function MonthGrid({ picks, selected, onSelect }: GridProps) {
  const cells = monthGrid(YEAR, MONTH_INDEX);
  return (
    <div className="month">
      <div className="month__head" aria-hidden="true">
        {WEEK_HEADERS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="month__grid">
        {cells.map((c, i) =>
          c.inMonth ? (
            <DayCell key={`d${c.day}`} day={c.day} picks={picks} selected={selected === c.day} onSelect={onSelect} />
          ) : (
            <span key={`o${i}`} className="cell cell--out" aria-hidden="true">
              <span className="cell__num">{c.day}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

interface CellProps {
  day: number;
  picks: Picks;
  selected: boolean;
  onSelect: (day: number) => void;
}

function CheckIcon() {
  return (
    <svg className="cell__check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function DayCell({ day, picks, selected, onSelect }: CellProps) {
  const info = dayInfo(day);
  const meals = MEALS.map((m) => ({ meal: m, entry: mealEntry(day, m.key, picks) })).filter(
    (x): x is { meal: (typeof MEALS)[number]; entry: MealEntry } => x.entry !== null,
  );
  const booked = meals.some((m) => m.entry.status === 'booked');
  let look: CellLook = info.region === 'nz' ? 'nz' : info.region === 'travel' ? 'travel' : 'plain';
  if (meals.length) look = booked ? 'booked' : 'picked';
  const loc = info.region === 'syd' ? '悉尼' : (info.loc ?? '');
  const summary = meals.length
    ? meals.map((m) => `${m.meal.label} ${entryName(m.entry)}（${entryStatus(m.entry)}）`).join('，')
    : '未安排';
  const where = info.region === 'nz' ? `新西兰 ${loc}` : info.region === 'travel' ? `飞行日 ${loc}` : loc;
  const aria = [dateLabel(YEAR, MONTH_INDEX, day), info.holiday, where, summary].filter(Boolean).join('，');

  return (
    <button
      type="button"
      className={`cell cell--${look}${info.region === 'nz' ? ' cell--in-nz' : ''}`}
      data-day={day}
      aria-pressed={selected}
      aria-label={aria}
      onClick={() => onSelect(day)}
    >
      <span className="cell__top">
        <span className="cell__num">{day}</span>
        {info.holiday && <span className="cell__holiday">{info.holiday}</span>}
      </span>
      {loc && (
        <span className="cell__loc" title={loc}>
          {loc}
        </span>
      )}
      {meals.map(({ meal, entry }) => (
        <span key={meal.key} className="cell__meal">
          <span className="cell__meal-name" title={`${meal.label} · ${entryName(entry)}`}>
            {entry.status === 'booked' && <CheckIcon />}
            {meal.short} · {entryName(entry)}
          </span>
          <span className="cell__chip">{entryCategory(entry)}</span>
        </span>
      ))}
      {meals.length > 0 && (
        <span className={`cell__mark${booked ? ' cell__mark--booked' : ''}`} aria-hidden="true">
          {booked && <CheckIcon />}
        </span>
      )}
    </button>
  );
}

export function Legend() {
  return (
    <ul className="legend" aria-label="图例">
      <li>
        <span className="swatch swatch--booked">
          <CheckIcon />
        </span>
        已预订
      </li>
      <li>
        <span className="swatch swatch--picked" />
        已选好
      </li>
      <li>
        <span className="swatch swatch--nz" />
        在新西兰
      </li>
      <li>
        <span className="swatch swatch--travel" />
        飞行日
      </li>
    </ul>
  );
}

export function mealsLeft(day: number, picks: Picks): Meal[] {
  return MEALS.filter((m) => !mealEntry(day, m.key, picks)).map((m) => m.key);
}
