import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { Legend, MonthGrid, dayCellElement } from './components/Calendar';
import { DayPanel } from './components/DayPanel';
import { CloseIcon } from './components/Icons';
import { RestaurantBoard, type BoardCategory } from './components/RestaurantBoard';
import { RestaurantPage } from './components/RestaurantPage';
import { SiteFooter } from './components/SiteFooter';
import { DAYS_IN_MONTH, MONTH_INDEX, NZ_TRIP_DAYS, YEAR, dayInfo } from './data/december';
import { RESTAURANT_BY_ID, VERIFIED_ON } from './data/restaurants';
import type { Meal, Restaurant } from './data/types';
import { usePicks, type SyncState } from './hooks/usePicks';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useRestaurantRoute } from './hooks/useRestaurantRoute';
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
  /** Element to return focus to when the toast is closed. */
  returnTo?: string;
}

const SYNC_LABEL: Record<Exclude<SyncState, 'local'>, string> = {
  connecting: '连接中…',
  live: '实时同步',
  error: '未同步',
};

const SYNC_HINT: Record<Exclude<SyncState, 'local'>, string> = {
  connecting: '正在连接共享日历',
  live: '打开这个网站的人看到的是同一份日历，改动会马上同步',
  error: '刚才的改动还没存到共享日历，会自动重试',
};

function formatVerified(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}

export default function App() {
  const [picks, setPicks, sync] = usePicks();
  const [day, setDay] = useState(() => initialDay());
  const [category, setCategory] = useState<BoardCategory>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastHeld, setToastHeld] = useState(false);
  const narrow = useMediaQuery(SHEET_QUERY);
  const calendarRef = useRef<HTMLElement>(null);
  const route = useRestaurantRoute();
  /** A day to show once the restaurant page has closed. */
  const pendingDay = useRef<number | null>(null);

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
        setToast({
          text: `已把 ${name} 加到 ${when}`,
          short: `已加到 12月${d}日${label}`,
          hint: dayInfo(d).plan,
          day: d,
          returnTo: pick.kind === 'restaurant' ? `addbtn-${pick.id}` : undefined,
        });
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
    if (route.id) {
      pendingDay.current = d;
      setToast(null);
      route.goTo('calendar');
      return;
    }
    // Move focus before the toast (and its button) disappears.
    dayCellElement(d)?.focus({ preventScroll: true });
    setDay(d);
    setToast(null);
    calendarRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (narrow) setSheetOpen(true);
  };

  const dismissToast = () => {
    const back = (toast?.returnTo && document.getElementById(toast.returnTo)) || (toast && dayCellElement(toast.day));
    back?.focus({ preventScroll: true });
    setToast(null);
    setToastHeld(false);
  };

  // The day sheet belongs to the main page; a restaurant page replaces it.
  useEffect(() => {
    if (route.id) setSheetOpen(false);
  }, [route.id]);

  // "Show in calendar" pressed on a restaurant page finishes once the main page is back.
  useEffect(() => {
    if (route.id || pendingDay.current === null) return;
    const d = pendingDay.current;
    pendingDay.current = null;
    showDay(d);
  }, [route.id]);

  const addFromList = (r: Restaurant, d: number, meal: Meal) => choose(d, meal, { kind: 'restaurant', id: r.id }, true);
  const toSection = (e: MouseEvent<HTMLAnchorElement>, section: string) => {
    if (!route.id) return;
    e.preventDefault();
    route.goTo(section);
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
            <a href="#list" onClick={(e) => toSection(e, 'list')}>
              餐厅榜单
            </a>
            <a href="#calendar" onClick={(e) => toSection(e, 'calendar')}>
              十二月日历
            </a>
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
            {sync !== 'local' && (
              <li className={`sync sync--${sync}`} title={SYNC_HINT[sync]}>
                <span className="sync__dot" />
                <span aria-live="polite">{SYNC_LABEL[sync]}</span>
              </li>
            )}
          </ul>
        </div>
      </header>

      {route.id && <RestaurantPage key={route.id} id={route.id} picks={picks} onAdd={addFromList} onClose={route.close} />}

      <main className="page" data-sheet-inert="" hidden={route.id !== null}>
        <RestaurantBoard category={category} onCategory={setCategory} picks={picks} onAdd={addFromList} />

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
      </main>

      <SiteFooter page={route.id ? `restaurant:${route.id}` : 'main'} verifiedOn={formatVerified(VERIFIED_ON)} shared={sync !== 'local'} />

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
            <button type="button" className="toast__btn" aria-label="在日历中查看" onClick={() => showDay(toast.day)}>
              <span className="toast__btn-long">在日历中查看</span>
              <span className="toast__btn-short">查看</span>
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
