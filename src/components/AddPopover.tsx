import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import type { Meal, Restaurant } from '../data/types';
import { dateLabel } from '../lib/calendar';
import { MEALS, closedLabel, closedOn, servesMeal } from '../lib/plan';
import { Segmented } from './Segmented';

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.label }));

interface AddPopoverProps {
  id: string;
  restaurant: Restaurant;
  meal: Meal;
  onMeal: (m: Meal) => void;
  /** Sydney days whose chosen meal is still open. */
  freeDays: number[];
  onPickDay: (day: number) => void;
}

/** "Which day?" chooser for putting a restaurant on the calendar. */
export function AddPopover({ id, restaurant: r, meal, onMeal, freeDays, onPickDay }: AddPopoverProps) {
  const mealLabel = MEALS.find((m) => m.key === meal)!.label;
  const anyClosed = freeDays.some((d) => closedOn(r, d));
  return (
    <div id={id} className="addpop" role="region" aria-label={`把 ${r.name} 加入日历`}>
      <div className="addpop__head">
        <span className="addpop__title">加到哪一天？</span>
        <Segmented label="哪一餐" options={MEAL_OPTIONS} value={meal} onChange={onMeal} />
        <span className="muted small">只列出人在悉尼、这一餐还空着的日子</span>
      </div>
      {!servesMeal(r, meal) && <p className="warn">提示：这家通常不做{mealLabel}，去之前确认一下营业时间。</p>}
      {anyClosed && <p className="muted small">这家{closedLabel(r)}，标着“可能休息”的日子去之前先确认。</p>}
      {freeDays.length ? (
        <div className="addpop__days">
          {freeDays.map((d) => {
            const holiday = dayInfo(d).holiday;
            const closed = closedOn(r, d);
            const text = `${dateLabel(YEAR, MONTH_INDEX, d)}${holiday ? ` · ${holiday}` : ''}`;
            return (
              <button
                key={d}
                type="button"
                className={`btn btn--ghost${holiday ? ' btn--holiday' : ''}${closed ? ' addpop__day--closed' : ''}`}
                aria-label={closed ? `${text}，可能休息` : undefined}
                onClick={() => onPickDay(d)}
              >
                {text}
                {closed && <span className="addpop__closed">可能休息</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted">在悉尼的日子{mealLabel}都安排满了。</p>
      )}
    </div>
  );
}
