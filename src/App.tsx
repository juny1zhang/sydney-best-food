import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { Legend, MonthGrid } from './components/Calendar';
import { DayPanel } from './components/DayPanel';
import { RestaurantBoard, type BoardCategory } from './components/RestaurantBoard';
import { DAYS_IN_MONTH, MONTH_INDEX, NZ_TRIP_DAYS, YEAR } from './data/december';
import { RESTAURANT_BY_ID, VERIFIED_ON } from './data/restaurants';
import type { Meal } from './data/types';
import { usePicks } from './hooks/usePicks';
import { useMediaQuery } from './hooks/useMediaQuery';
import { dateLabel } from './lib/calendar';
import { MEALS, countMeals, removePick, setPick, type Pick } from './lib/plan';

const FIRST_SYDNEY_DAY = 3;

function initialDay(now = new Date()): number {
  return now.getFullYear() === YEAR && now.getMonth() === MONTH_INDEX ? now.getDate() : FIRST_SYDNEY_DAY;
}

interface Toast {
  text: string;
  day: number;
}

export default function App() {
  const [picks, setPicks] = usePicks();
  const [day, setDay] = useState(() => initialDay());
  const [category, setCategory] = useState<BoardCategory>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const narrow = useMediaQuery('(max-width: 720px)');
  const calendarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const choose = useCallback(
    (d: number, meal: Meal, pick: Pick, announce = false) => {
      setPicks((p) => setPick(p, d, meal, pick));
      setDay(d);
      if (announce) {
        const name = pick.kind === 'restaurant' ? (RESTAURANT_BY_ID.get(pick.id)?.name ?? '') : pick.name;
        const label = MEALS.find((m) => m.key === meal)!.label;
        setToast({ text: `已把 ${name} 加到 ${dateLabel(YEAR, MONTH_INDEX, d)} ${label}`, day: d });
      }
    },
    [setPicks],
  );

  const clear = useCallback((d: number, meal: Meal) => setPicks((p) => removePick(p, d, meal)), [setPicks]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const selectDay = (d: number) => {
    setDay(d);
    if (narrow) setSheetOpen(true);
  };

  const showDay = (d: number) => {
    setDay(d);
    setToast(null);
    calendarRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (narrow) setSheetOpen(true);
  };

  const summary = countMeals(picks, DAYS_IN_MONTH);
  const panel = (
    <DayPanel key={day} day={day} picks={picks} boardCategory={category} titleId="day-h" onChoose={(d, m, p) => choose(d, m, p)} onClear={clear} />
  );

  return (
    <div className="app">
      <header className="masthead">
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

      <main className="page">
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
          排名依据 2026 年公开榜单与媒体推荐整理，营业状态核对于 {VERIFIED_ON.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1 年 $2 月 $3 日')}
          。每家店的“评价依据”里有来源链接。你选的店只保存在这台设备的浏览器里。
        </footer>
      </main>

      {narrow && sheetOpen && (
        <BottomSheet labelledBy="day-h" onClose={closeSheet}>
          {panel}
        </BottomSheet>
      )}

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.text}</span>
            <button type="button" className="toast__btn" onClick={() => showDay(toast.day)}>
              在日历中查看
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
