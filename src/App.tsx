import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { Legend, MonthGrid, dayCellElement } from './components/Calendar';
import { DayPanel } from './components/DayPanel';
import { CloseIcon } from './components/Icons';
import { ImportDialog, ShareDialog } from './components/PlanDialogs';
import { PlanOverview } from './components/PlanOverview';
import { RestaurantBoard, type BoardCategory } from './components/RestaurantBoard';
import { MONTH_INDEX, NZ_TRIP_DAYS, YEAR, dayInfo } from './data/december';
import { NZ_VERIFIED_ON } from './data/nz';
import { placeById } from './data/places';
import { VERIFIED_ON } from './data/restaurants';
import type { Meal } from './data/types';
import { usePicks } from './hooks/usePicks';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useWishlist } from './hooks/useWishlist';
import { dateLabel } from './lib/calendar';
import { downloadIcs } from './lib/ics';
import { countMeals, mealLabel, planItems, removePick, setPick, setReservation, type Pick, type Reservation } from './lib/plan';
import { countPicks, decodePlan, mergePicks, shareUrl, type SharedPlan } from './lib/share';

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
  /** Day the "在日历中查看" button opens; no button without it. */
  day?: number;
  /** Element to return focus to when the toast is closed. */
  returnTo?: string;
}

function formatVerified(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}

function pageBase(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function clearHash(): void {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export default function App() {
  const [picks, setPicks] = usePicks();
  const wishlist = useWishlist();
  const [day, setDay] = useState(() => initialDay());
  const [category, setCategory] = useState<BoardCategory>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastHeld, setToastHeld] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<SharedPlan | null>(() => decodePlan(window.location.hash));
  const narrow = useMediaQuery(SHEET_QUERY);
  const calendarRef = useRef<HTMLElement>(null);

  // Auto-dismiss the toast, but never while the pointer or focus is on it.
  useEffect(() => {
    if (!toast || toastHeld) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast, toastHeld]);

  // A share link pasted into an open tab.
  useEffect(() => {
    const onHash = () => {
      const plan = decodePlan(window.location.hash);
      if (plan) setIncoming(plan);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const sheetVisible = narrow && sheetOpen;

  const showToast = (t: Toast) => {
    setToast(t);
    setToastHeld(false);
  };

  const choose = useCallback(
    (d: number, meal: Meal, pick: Pick, announce = false) => {
      setPicks((p) => setPick(p, d, meal, pick));
      setDay(d);
      if (announce) {
        const name = pick.kind === 'restaurant' ? (placeById(pick.id)?.name ?? '') : pick.name;
        const label = mealLabel(meal);
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
  const reserve = useCallback(
    (d: number, meal: Meal, r: Reservation | null) => setPicks((p) => setReservation(p, d, meal, r)),
    [setPicks],
  );
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const selectedCell = useCallback(() => dayCellElement(day), [day]);
  const planHeading = useCallback(() => document.getElementById('plan-h'), []);

  const selectDay = (d: number) => {
    setDay(d);
    if (narrow) setSheetOpen(true);
  };

  const showDay = (d: number) => {
    // Move focus before the control that asked for it (e.g. the toast button) disappears.
    dayCellElement(d)?.focus({ preventScroll: true });
    setDay(d);
    setToast(null);
    calendarRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (narrow) setSheetOpen(true);
  };

  const dismissToast = () => {
    const back =
      (toast?.returnTo && document.getElementById(toast.returnTo)) || (toast?.day !== undefined && dayCellElement(toast.day)) || null;
    back?.focus({ preventScroll: true });
    setToast(null);
    setToastHeld(false);
  };

  const items = planItems(picks);
  const summary = countMeals(picks);
  const myPickCount = countPicks(picks);

  const exportPlan = () => {
    downloadIcs(items);
    showToast({
      text: `已生成日历文件（${items.length} 餐），打开它就能加进手机或电脑的日历`,
      short: `已生成日历文件，${items.length} 餐`,
    });
  };

  const finishImport = (plan: SharedPlan | null, mode: 'merge' | 'replace' | 'cancel') => {
    clearHash();
    setIncoming(null);
    if (!plan || mode === 'cancel') return;
    setPicks((mine) => (mode === 'replace' ? plan.picks : mergePicks(mine, plan.picks)));
    // Saved places are only ever added to, never wiped by someone else's link.
    wishlist.setIds((mine) => [...new Set([...mine, ...plan.wishlist])]);
    const n = countPicks(plan.picks);
    showToast({ text: `已导入 ${n} 餐安排`, short: `已导入 ${n} 餐` });
  };

  const panel = (
    <DayPanel
      key={day}
      day={day}
      picks={picks}
      boardCategory={category}
      wishlist={wishlist.ids}
      titleId="day-h"
      onChoose={(d, m, p) => choose(d, m, p)}
      onClear={clear}
      onReserve={reserve}
    />
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
            <a href="#plan">我的计划</a>
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
          wishlist={wishlist.ids}
          onToggleWish={wishlist.toggle}
          onAdd={(r, d, meal) => choose(d, meal, { kind: 'restaurant', id: r.id }, true)}
        />

        <section id="calendar" ref={calendarRef} aria-labelledby="cal-h" className="calendar">
          <div className="section-head">
            <div className="section-head__text">
              <h2 id="cal-h">十二月 · 每天吃什么</h2>
              <p>点日期看当天安排。订好位的餐厅会把日期涂成橙色，选好还没订的是蓝色；在悉尼的日子从榜单挑，在新西兰的日子有沿途推荐。</p>
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

        <PlanOverview
          items={items}
          onShowDay={showDay}
          onExport={exportPlan}
          onShare={() => setSharing(shareUrl({ picks, wishlist: wishlist.ids }, pageBase()))}
          canShare={myPickCount > 0 || wishlist.ids.length > 0}
        />

        <footer className="foot">
          排名依据 2026 年公开榜单与媒体推荐整理，营业状态核对于 {formatVerified(VERIFIED_ON)}
          ；新西兰沿途推荐整理于 {formatVerified(NZ_VERIFIED_ON)}，营业时间出发前请再确认。每家店的“评价依据”里有来源链接。你的安排保存在这台设备的浏览器里，用「分享给家人」可以发到另一台手机。
        </footer>
      </main>

      {sheetVisible && (
        <BottomSheet labelledBy="day-h" onClose={closeSheet} fallbackFocus={selectedCell}>
          {panel}
        </BottomSheet>
      )}

      {sharing && <ShareDialog url={sharing} onClose={() => setSharing(null)} fallbackFocus={planHeading} />}

      {incoming && (
        <ImportDialog
          plan={incoming}
          myCount={myPickCount}
          onMerge={() => finishImport(incoming, 'merge')}
          onReplace={() => finishImport(incoming, 'replace')}
          onCancel={() => finishImport(null, 'cancel')}
          fallbackFocus={planHeading}
        />
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
            {toast.day !== undefined && (
              <button type="button" className="toast__btn" aria-label="在日历中查看" onClick={() => showDay(toast.day!)}>
                <span className="toast__btn-long">在日历中查看</span>
                <span className="toast__btn-short">查看</span>
              </button>
            )}
            <button type="button" className="toast__close" aria-label="关闭提示" onClick={dismissToast}>
              <CloseIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
