import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { Legend, MonthGrid, dayCellElement } from './components/Calendar';
import { DayPanel } from './components/DayPanel';
import { CloseIcon } from './components/Icons';
import { RestaurantBoard, type BoardCategory } from './components/RestaurantBoard';
import { DAYS_IN_MONTH, MONTH_INDEX, NZ_TRIP_DAYS, YEAR, dayInfo } from './data/december';
import { RESTAURANT_BY_ID, VERIFIED_ON } from './data/restaurants';
import type { Meal } from './data/types';
import { usePicks } from './hooks/usePicks';
import { useMediaQuery } from './hooks/useMediaQuery';
import { dateLabel } from './lib/calendar';
import { MEALS, countMeals, removePick, setPick, type Pick } from './lib/plan';

const FIRST_SYDNEY_DAY = 3;
const TOAST_MS = 6000;
/** Below this width the day panel can't sit beside the calendar, so it opens as a sheet. */
const SHEET_QUERY = '(max-width: 1047px), (max-height: 500px)';

function initialDay(now = new Date()): number {
  return now.getFullYear() === YEAR && now.getMonth() === MONTH_INDEX ? now.getDate() : FIRST_SYDNEY_DAY;
}

interface Toast {
  /** Full sentence, e.g. "已把 Lee Ho Fook Sydney 加到 12月4日 周五 晚餐". */
  text: string;
  /** Compact version for phones. */
  short: string;
  hint?: string;
  day: number;
}

function formatVerified(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}

export default function App() {
  const [picks, setPicks] = usePicks();
  const [day, setDay] = useState(() => initialDay());
  const [category, setCategory] = useState<BoardCategory>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastHeld, setToastHeld] = useState(false);
  const narrow = useMediaQuery(SHEET_QUERY);
  const calendarRef = useRef<HTMLElement>(null);

  // Auto-dismiss the toast, but never while the pointer or focus is on it.
  useEffect(() => {
    if (!toast || toastHeld) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast, toastHeld]);

  const sheetVisible = narrow && sheetOpen;

  const choose = useCallback(
    (d: number, meal: Meal, pick: Pick, announce = false) => {
      setPicks((p) => setPick(p, d, meal, pick));
      setDay(d);
      if (announce) {
        const name = pick.kind === 'restaurant' ? (RESTAURANT_BY_ID.get(pick.id)?.name ?? '') : pick.name;
        const label = MEALS.find((m) => m.key === meal)!.label;
        const when = `${dateLabel(YEAR, MONTH_INDEX, d)} ${label}`;
        setToast({ text: `已把 ${name} 加到 ${when}`, short: `已加到 ${when}`, hint: dayInfo(d).plan, day: d });
        setToastHeld(false);
      }
    },
    [setPicks],
  );

  const clear = useCallback((d: number, meal: Meal) => setPicks((p) => removePick(p, d, meal)), [setPicks]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const selectedCell = useCallback(() => dayCellElement(day), [day]);

  const selectDay = (d: number) => {
    setDay(d);
    if (narrow) setSheetOpen(true);
  };

  const showDay = (d: number) => {
    // Move focus before the toast (and its button) disappears.
    dayCellElement(d)?.focus({ preventScroll: true });
    setDay(d);
    setToast(null);
    calendarRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (narrow) setSheetOpen(true);
  };

  const dismissToast = () => {
    setToast(null);
    setToastHeld(false);
  };

  const summary = countMeals(picks, DAYS_IN_MONTH);
  const panel = (
    <DayPanel key={day} day={day} picks={picks} boardCategory={category} titleId="day-h" onChoose={(d, m, p) => choose(d, m, p)} onClear={clear} />
  );

  return (
    <div className="app">
      <header className="masthead" data-sheet-inert="">
        <div className="masthead__inner">
          <div className="brand">
            <span className="brand__name">悉尼吃什么</span>
            <span className="brand__sub">SYDNEY EATS · 2026.12</span>
          </div>
          <nav aria-label="页面导航" className="masthead__nav">
            <a href="#list">餐厅榜单</a>
            <a href="#calendar">十二月日历</a>
          </nav>
          <ul className="masthead__stats" aria-label="十二月概况">
            <li>
              <span className="swatch swatch--booked" />
              已订 {summary.booked} 餐
            </li>
            <li>
              <span className="swatch swatch--picked" />
              已选 {summary.picked} 餐
            </li>
            <li>
              <span className="swatch swatch--nz" />
              新西兰 {NZ_TRIP_DAYS} 天
            </li>
          </ul>
        </div>
      </header>

      <main className="page" data-sheet-inert="">
        <RestaurantBoard
          category={category}
          onCategory={setCategory}
          picks={picks}
          onAdd={(r, d, meal) => choose(d, meal, { kind: 'restaurant', id: r.id }, true)}
        />

        <section id="calendar" ref={calendarRef} aria-labelledby="cal-h" className="calendar">
          <div className="section-head">
            <div className="section-head__text">
              <h2 id="cal-h">十二月 · 每天吃什么</h2>
              <p>点日期看当天安排。已订的餐厅和你选好的餐厅会把日期涂上颜色；人在悉尼的空日子，可以直接从榜单挑一家。</p>
            </div>
            <Legend />
          </div>
          <div className="calendar__body">
            <MonthGrid picks={picks} selected={day} onSelect={selectDay} />
            {!narrow && (
              <aside className="calendar__aside" aria-labelledby="day-h">
                {panel}
              </aside>
            )}
          </div>
        </section>

        <footer className="foot">
          排名依据 2026 年公开榜单与媒体推荐整理，营业状态核对于 {formatVerified(VERIFIED_ON)}
          。每家店的“评价依据”里有来源链接。你选的店只保存在这台设备的浏览器里。
        </footer>
      </main>

      {sheetVisible && (
        <BottomSheet labelledBy="day-h" onClose={closeSheet} fallbackFocus={selectedCell}>
          {panel}
        </BottomSheet>
      )}

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div
            className="toast"
            onMouseEnter={() => setToastHeld(true)}
            onMouseLeave={() => setToastHeld(false)}
            onFocus={() => setToastHeld(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setToastHeld(false);
            }}
          >
            <div className="toast__text">
              <span className="toast__long">{toast.text}</span>
              <span className="toast__short">{toast.short}</span>
              {toast.hint && <span className="toast__hint">{toast.hint}</span>}
            </div>
            <button type="button" className="toast__btn" onClick={() => showDay(toast.day)}>
              在日历中查看
            </button>
            <button type="button" className="toast__close" aria-label="关闭提示" onClick={dismissToast}>
              <CloseIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
