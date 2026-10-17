import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import { dateLabel } from '../lib/calendar';
import { entryCategory, entryName, isReserved, mealLabel, reservedTime, type PlanItem } from '../lib/plan';

interface PlanProps {
  items: PlanItem[];
  onShowDay: (day: number) => void;
  onExport: () => void;
  onShare: () => void;
  canShare: boolean;
}

function whereLabel(day: number): string {
  const info = dayInfo(day);
  if (info.region === 'syd') return '悉尼';
  if (info.region === 'nz') return `新西兰 · ${info.loc}`;
  return info.loc ?? '';
}

/** Every planned meal in date order, with what still needs a booking. */
export function PlanOverview({ items, onShowDay, onExport, onShare, canShare }: PlanProps) {
  const days = [...new Set(items.map((i) => i.day))];
  const booked = items.filter((i) => isReserved(i.entry)).length;
  const pending = items.length - booked;

  return (
    <section id="plan" aria-labelledby="plan-h" className="plan">
      <div className="section-head">
        <div className="section-head__text">
          <h2 id="plan-h">我的十二月计划</h2>
          <p>按日期列出每一餐。订好位的是橙色；只选好、还没订位的是蓝色，后面附订位提示。</p>
        </div>
        <div className="plan__actions">
          <button type="button" className="btn btn--outline" onClick={onExport} disabled={!items.length}>
            导出到手机日历
          </button>
          <button type="button" className="btn btn--primary" onClick={onShare} disabled={!canShare}>
            分享给家人
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <p className="plan__summary" aria-live="polite">
          共 {items.length} 餐：<strong className="plan__count plan__count--booked">已订位 {booked}</strong>
          <strong className="plan__count plan__count--picked">还没订位 {pending}</strong>
        </p>
      )}

      {items.length ? (
        <ol className="plan__days">
          {days.map((day) => (
            <li key={day} className="plan__day">
              <div className="plan__date">
                <span className="plan__date-main">{dateLabel(YEAR, MONTH_INDEX, day)}</span>
                <span className="muted small">
                  {whereLabel(day)}
                  {dayInfo(day).holiday ? ` · ${dayInfo(day).holiday}` : ''}
                </span>
              </div>
              <ul className="plan__meals">
                {items
                  .filter((i) => i.day === day)
                  .map(({ meal, entry }) => {
                    const reserved = isReserved(entry);
                    const time = reservedTime(entry);
                    const tip =
                      entry.status === 'booked'
                        ? entry.booking.note
                        : reserved
                          ? entry.reserved?.note
                          : entry.status === 'picked'
                            ? `订位：${entry.place.booking}`
                            : entry.pick.note;
                    return (
                      <li key={meal} className={`plan__meal${reserved ? ' plan__meal--booked' : ''}`}>
                        <div className="plan__meal-main">
                          <span className="plan__meal-label">{mealLabel(meal)}</span>
                          <span className="plan__meal-name">{entryName(entry)}</span>
                          <span className="tag">{entryCategory(entry)}</span>
                          <span className={`pill ${reserved ? 'pill--booked' : 'pill--picked'}`}>
                            {reserved ? `已预订${time ? ` · ${time}` : ''}` : '还没订位'}
                          </span>
                        </div>
                        {tip && <span className="muted small">{tip}</span>}
                      </li>
                    );
                  })}
              </ul>
              <button type="button" className="btn btn--ghost plan__go" onClick={() => onShowDay(day)} aria-label={`打开这天：${dateLabel(YEAR, MONTH_INDEX, day)}`}>
                打开这天
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">还没有安排。在上面的榜单点「加入日历」，或者在日历里点一天开始挑。</p>
      )}
    </section>
  );
}
