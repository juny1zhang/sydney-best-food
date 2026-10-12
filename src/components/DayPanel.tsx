import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import { CATEGORIES, categoryOf, mapsUrl, restaurantsIn, searchRestaurants } from '../data/restaurants';
import type { Meal, Restaurant } from '../data/types';
import { dateLabel } from '../lib/calendar';
import { detailHref } from '../lib/route';
import { MEALS, mealEntry, servesMeal, type MealEntry, type Pick, type Picks } from '../lib/plan';
import type { BoardCategory } from './RestaurantBoard';
import { mealsLeft } from './Calendar';
import { PinIcon } from './Icons';
import { Segmented } from './Segmented';

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.label }));
const SUGGESTIONS = 5;

function mealLabel(meal: Meal): string {
  return MEALS.find((m) => m.key === meal)!.label;
}

interface PanelProps {
  day: number;
  picks: Picks;
  boardCategory: BoardCategory;
  titleId: string;
  onChoose: (day: number, meal: Meal, pick: Pick) => void;
  onClear: (day: number, meal: Meal) => void;
}

export function DayPanel({ day, picks, boardCategory, titleId, onChoose, onClear }: PanelProps) {
  const info = dayInfo(day);
  const open = mealsLeft(day, picks);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [meal, setMeal] = useState<Meal>(open.includes('dinner') || !open.length ? 'dinner' : open[0]);
  const [replacing, setReplacing] = useState<Meal | null>(null);
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  // The meals the picker or the form may write to right now.
  const writable: Meal[] = replacing ? [replacing] : open;
  const target: Meal | null = writable.includes(meal) ? meal : (writable[0] ?? null);

  // Actions below unmount the control that was pressed, so park focus on the day heading.
  const refocus = () => requestAnimationFrame(() => headingRef.current?.focus());

  // Nothing left to write to (both meals filled elsewhere): drop the custom form.
  useEffect(() => {
    if (target === null) setCustomOpen(false);
  }, [target]);

  const choose = (m: Meal, pick: Pick) => {
    onChoose(day, m, pick);
    setReplacing(null);
    setCustomOpen(false);
    setQuery('');
    refocus();
  };

  const eyebrow =
    info.region === 'nz'
      ? `新西兰第 ${info.trip} 天 · ${info.loc}`
      : info.region === 'syd'
        ? '悉尼'
        : info.region === 'travel'
          ? `飞行日 · ${info.loc}`
          : '十二月';

  const showPicker = info.region === 'syd' && target !== null && !customOpen;
  const showElsewhere = info.region !== 'syd' && target !== null && !customOpen;

  return (
    <div className="panel">
      <div className="panel__head">
        <span className={`eyebrow${info.region === 'nz' ? ' eyebrow--nz' : ''}`}>{eyebrow}</span>
        <h3 id={titleId} ref={headingRef} tabIndex={-1}>
          {dateLabel(YEAR, MONTH_INDEX, day)}
          {info.holiday ? ` · ${info.holiday}` : ''}
        </h3>
        {info.plan && (
          <p className="panel__plan">
            <PinIcon />
            <span>{info.plan}</span>
          </p>
        )}
      </div>

      {MEALS.map((m) => (
        <MealSlot
          key={m.key}
          label={m.label}
          meal={m.key}
          entry={mealEntry(day, m.key, picks)}
          replacing={replacing === m.key}
          regionNote={info.region === 'syd' ? '还空着，可以在下面挑一家。' : info.region === 'nz' ? '还没定。' : '这天还没有计划。'}
          onReplace={() => {
            setReplacing(m.key);
            setMeal(m.key);
            setCustomOpen(false);
            requestAnimationFrame(() => document.getElementById(`picker-q-${day}`)?.focus());
          }}
          onClear={() => {
            onClear(day, m.key);
            setReplacing(null);
            setMeal(m.key);
            refocus();
          }}
        />
      ))}

      {showPicker && (
        <Picker
          day={day}
          meal={target}
          writable={writable}
          replacing={replacing !== null}
          onMeal={setMeal}
          query={query}
          onQuery={setQuery}
          boardCategory={boardCategory}
          onPick={(r) => choose(target, { kind: 'restaurant', id: r.id })}
          onCancelReplace={() => {
            setReplacing(null);
            refocus();
          }}
          onCustom={() => setCustomOpen(true)}
        />
      )}

      {showElsewhere && (
        <div className="elsewhere">
          <p>{info.region === 'nz' ? '这天人在新西兰，悉尼榜单用不上。想到当地要吃的店，可以手动记下来。' : '这天不在悉尼，可以手动记一家店。'}</p>
          <button type="button" className="btn btn--outline-green" onClick={() => setCustomOpen(true)}>
            手动添加一家店
          </button>
        </div>
      )}

      {customOpen && target !== null && (
        <CustomForm
          writable={writable}
          meal={target}
          onMeal={setMeal}
          onCancel={() => {
            setCustomOpen(false);
            refocus();
          }}
          onSave={(name, note) => choose(target, { kind: 'custom', name, note })}
        />
      )}
    </div>
  );
}

interface SlotProps {
  label: string;
  meal: Meal;
  entry: MealEntry | null;
  replacing: boolean;
  regionNote: string;
  onReplace: () => void;
  onClear: () => void;
}

function MealSlot({ label, meal, entry, replacing, regionNote, onReplace, onClear }: SlotProps) {
  if (!entry) {
    return (
      <div className="slot">
        <div className="slot__head">
          <span className="slot__label">{label}</span>
          <span className="pill">未安排</span>
        </div>
        <span className="muted">{regionNote}</span>
      </div>
    );
  }

  if (entry.status === 'booked') {
    const v = entry.booking.venue;
    return (
      <div className="slot">
        <div className="slot__head">
          <span className="slot__label">{label}</span>
          <span className="pill pill--booked">已预订 · {entry.booking.time}</span>
        </div>
        <div className="slot__name">
          <span>{v.name}</span>
          <span className="muted">
            {v.address} · {v.price}
          </span>
        </div>
        <div className="chips">
          <span className="chip-cat chip-cat--booked">{v.categoryLabel}</span>
          {v.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <p className="slot__intro">{v.intro}</p>
        <span className="muted small">{entry.booking.note}</span>
        <div className="slot__links">
          <a href={mapsUrl(v.name, v.address)} target="_blank" rel="noreferrer">
            在地图中打开
          </a>
          {v.website && (
            <a href={v.website} target="_blank" rel="noreferrer">
              官网
            </a>
          )}
        </div>
      </div>
    );
  }

  if (entry.status === 'custom') {
    return (
      <div className="slot">
        <div className="slot__head">
          <span className="slot__label">{label}</span>
          <span className="pill pill--picked">已选好</span>
        </div>
        <div className="slot__name">
          <span>{entry.pick.name}</span>
          <span className="muted">自己记的</span>
        </div>
        {entry.pick.note && <p className="slot__intro">{entry.pick.note}</p>}
        <div className="slot__actions">
          <button type="button" className="btn btn--ghost" onClick={onClear} aria-label={`删除${label} ${entry.pick.name}`}>
            删除
          </button>
        </div>
      </div>
    );
  }

  const r = entry.restaurant;
  return (
    <div className="slot">
      <div className="slot__head">
        <span className="slot__label">{label}</span>
        <span className="pill pill--picked">{replacing ? '正在换' : '已选好'}</span>
      </div>
      <div className="slot__name">
        <span>{r.name}</span>
        <span className="muted">
          {r.nameZh ? `${r.nameZh} · ` : ''}
          {r.suburb} · {r.price}
        </span>
      </div>
      <div className="chips">
        <span className="chip-cat chip-cat--picked">{categoryOf(r.category).name}</span>
        {r.badges.map((b) => (
          <span key={b} className="badge">
            {b}
          </span>
        ))}
        {r.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <p className="slot__intro">{r.intro}</p>
      <span className="muted small">订位：{r.booking}</span>
      {!servesMeal(r, meal) && <p className="warn">提示：这家通常不做{label}，去之前确认一下营业时间。</p>}
      <div className="slot__links">
        <a href={detailHref(r.id)}>菜单和招牌菜</a>
        <a href={mapsUrl(r.name, `${r.suburb} Sydney`)} target="_blank" rel="noreferrer">
          在地图中打开
        </a>
        {r.website && (
          <a href={r.website} target="_blank" rel="noreferrer">
            官网
          </a>
        )}
      </div>
      {!replacing && (
        <div className="slot__actions">
          <button type="button" className="btn btn--ghost" onClick={onReplace} aria-label={`换一家：${label}`}>
            换一家
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClear} aria-label={`删除：${label} ${r.name}`}>
            删除
          </button>
        </div>
      )}
    </div>
  );
}

interface PickerProps {
  day: number;
  meal: Meal;
  writable: Meal[];
  replacing: boolean;
  onMeal: (m: Meal) => void;
  query: string;
  onQuery: (q: string) => void;
  boardCategory: BoardCategory;
  onPick: (r: Restaurant) => void;
  onCancelReplace: () => void;
  onCustom: () => void;
}

function Picker({ day, meal, writable, replacing, onMeal, query, onQuery, boardCategory, onPick, onCancelReplace, onCustom }: PickerProps) {
  const [showAll, setShowAll] = useState(false);
  const searching = query.trim().length > 0;
  const label = mealLabel(meal);

  let pool: Restaurant[];
  let source: string;
  if (searching) {
    pool = searchRestaurants(query);
    source = `找到 ${pool.length} 家`;
  } else if (boardCategory !== 'all') {
    pool = restaurantsIn(boardCategory);
    source = `${categoryOf(boardCategory).name}榜单 ${pool.length} 家`;
  } else {
    pool = CATEGORIES.map((c) => restaurantsIn(c.id)[0]);
    source = `各类第一名 ${pool.length} 家`;
  }
  // Keep rank order, but venues that serve this meal come first.
  const ordered = [...pool.filter((r) => servesMeal(r, meal)), ...pool.filter((r) => !servesMeal(r, meal))];
  const shown = showAll ? ordered : ordered.slice(0, SUGGESTIONS);
  const heading = !pool.length
    ? '没找到，换个关键词试试，比如“烤鸭”“pizza”“Surry Hills”'
    : `${source}，做${label}的排在前面${shown.length < pool.length ? `，先显示 ${shown.length} 家` : ''}`;
  const inputId = `picker-q-${day}`;

  return (
    <div className="picker">
      <div className="picker__head">
        <span className="picker__title">{replacing ? `给${label}换一家` : '从榜单挑一家'}</span>
        {writable.length > 1 ? (
          <Segmented label="哪一餐" options={MEAL_OPTIONS} value={meal} onChange={onMeal} />
        ) : (
          <span className="pill">{label}</span>
        )}
      </div>
      <label className="field" htmlFor={inputId}>
        搜索餐厅、菜系或区域
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            setShowAll(false);
          }}
          placeholder="例如：烤鸭、omakase、Surry Hills"
          autoComplete="off"
        />
      </label>
      <span className="muted small" aria-live="polite">
        {heading}
      </span>
      {shown.length > 0 && (
        <ul className="picker__list">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="picker__item">
                <span className="picker__name">{r.name}</span>
                <span className="muted small">
                  {categoryOf(r.category).short}第 {r.rank} 名 · {r.suburb} · {r.price}
                  {r.badges[0] ? ` · ${r.badges[0]}` : ''}
                </span>
                {!servesMeal(r, meal) && <span className="picker__warn">通常不做{label}</span>}
              </div>
              <button type="button" className="btn btn--primary" aria-label={`选这家：${r.name}（${label}）`} onClick={() => onPick(r)}>
                选这家
              </button>
            </li>
          ))}
        </ul>
      )}
      {ordered.length > SUGGESTIONS && (
        <button type="button" className="linkish" onClick={() => setShowAll(!showAll)}>
          {showAll ? '收起' : `显示全部 ${ordered.length} 家`}
        </button>
      )}
      <div className="picker__foot">
        <button type="button" className="linkish" onClick={onCustom}>
          不在榜单里？手动添加一家
        </button>
        {replacing && (
          <button type="button" className="btn btn--ghost" onClick={onCancelReplace}>
            不换了
          </button>
        )}
      </div>
    </div>
  );
}

interface CustomProps {
  writable: Meal[];
  meal: Meal;
  onMeal: (m: Meal) => void;
  onCancel: () => void;
  onSave: (name: string, note: string) => void;
}

function CustomForm({ writable, meal, onMeal, onCancel, onSave }: CustomProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const options = MEAL_OPTIONS.filter((o) => writable.includes(o.value));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), note.trim());
  };

  return (
    <form className="custom" onSubmit={submit} aria-label="手动添加一家店">
      <div className="picker__head">
        <span className="picker__title">手动添加一家店</span>
        {options.length > 1 ? (
          <Segmented label="哪一餐" options={options} value={meal} onChange={onMeal} />
        ) : (
          <span className="pill">{mealLabel(meal)}</span>
        )}
      </div>
      <label className="field">
        店名
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus />
      </label>
      <label className="field">
        备注（可选）
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="比如：想吃的菜、订位时间" />
      </label>
      <div className="custom__actions">
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          保存
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
