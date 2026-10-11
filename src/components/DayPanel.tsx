import { useState, type FormEvent } from 'react';
import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import { CATEGORIES, categoryOf, mapsUrl, restaurantsIn, searchRestaurants } from '../data/restaurants';
import type { Meal, Restaurant } from '../data/types';
import { dateLabel } from '../lib/calendar';
import { MEALS, mealEntry, servesMeal, type MealEntry, type Pick, type Picks } from '../lib/plan';
import type { BoardCategory } from './RestaurantBoard';
import { mealsLeft } from './Calendar';
import { PinIcon } from './Icons';
import { Segmented } from './Segmented';

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.label }));
const SUGGESTIONS = 5;

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
  const [meal, setMeal] = useState<Meal>(open.includes('dinner') || !open.length ? 'dinner' : open[0]);
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  const eyebrow =
    info.region === 'nz'
      ? `新西兰第 ${info.trip} 天 · ${info.loc}`
      : info.region === 'syd'
        ? '悉尼'
        : info.region === 'travel'
          ? `飞行日 · ${info.loc}`
          : '十二月';

  const showPicker = info.region === 'syd' && open.length > 0;
  const showElsewhere = info.region !== 'syd' && open.length > 0;

  return (
    <div className="panel">
      <div className="panel__head">
        <span className={`eyebrow${info.region === 'nz' ? ' eyebrow--nz' : ''}`}>{eyebrow}</span>
        <h3 id={titleId}>
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
          regionNote={info.region === 'syd' ? '还空着，可以在下面挑一家。' : info.region === 'nz' ? '还没定。' : '这天还没有计划。'}
          onClear={() => {
            onClear(day, m.key);
            setMeal(m.key);
          }}
        />
      ))}

      {showPicker && !customOpen && (
        <Picker
          day={day}
          meal={open.includes(meal) ? meal : open[0]}
          openMeals={open}
          onMeal={setMeal}
          query={query}
          onQuery={setQuery}
          boardCategory={boardCategory}
          onPick={(r, chosenMeal) => onChoose(day, chosenMeal, { kind: 'restaurant', id: r.id })}
          onCustom={() => setCustomOpen(true)}
        />
      )}

      {showElsewhere && !customOpen && (
        <div className="elsewhere">
          <p>{info.region === 'nz' ? '这天人在新西兰，悉尼榜单用不上。想到当地要吃的店，可以手动记下来。' : '这天不在悉尼，可以手动记一家店。'}</p>
          <button type="button" className="btn btn--outline-green" onClick={() => setCustomOpen(true)}>
            手动添加一家店
          </button>
        </div>
      )}

      {customOpen && (
        <CustomForm
          openMeals={open}
          initialMeal={open.includes(meal) ? meal : open[0]}
          onCancel={() => setCustomOpen(false)}
          onSave={(chosenMeal, name, note) => {
            onChoose(day, chosenMeal, { kind: 'custom', name, note });
            setCustomOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface SlotProps {
  label: string;
  meal: Meal;
  entry: MealEntry | null;
  regionNote: string;
  onClear: () => void;
}

function MealSlot({ label, meal, entry, regionNote, onClear }: SlotProps) {
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
          <button type="button" className="btn btn--ghost" onClick={onClear}>
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
        <span className="pill pill--picked">已选好</span>
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
        <a href={mapsUrl(r.name, `${r.suburb} Sydney`)} target="_blank" rel="noreferrer">
          在地图中打开
        </a>
        {r.website && (
          <a href={r.website} target="_blank" rel="noreferrer">
            官网
          </a>
        )}
      </div>
      <div className="slot__actions">
        <button type="button" className="btn btn--ghost" onClick={onClear}>
          换一家
        </button>
      </div>
    </div>
  );
}

interface PickerProps {
  day: number;
  meal: Meal;
  openMeals: Meal[];
  onMeal: (m: Meal) => void;
  query: string;
  onQuery: (q: string) => void;
  boardCategory: BoardCategory;
  onPick: (r: Restaurant, meal: Meal) => void;
  onCustom: () => void;
}

function Picker({ day, meal, openMeals, onMeal, query, onQuery, boardCategory, onPick, onCustom }: PickerProps) {
  const searching = query.trim().length > 0;
  let pool: Restaurant[];
  let heading: string;
  if (searching) {
    pool = searchRestaurants(query);
    heading = pool.length ? `找到 ${pool.length} 家` : '没找到，换个关键词试试';
  } else if (boardCategory !== 'all') {
    pool = restaurantsIn(boardCategory);
    heading = `${categoryOf(boardCategory).name}前 ${Math.min(SUGGESTIONS, pool.length)} 名`;
  } else {
    pool = CATEGORIES.map((c) => restaurantsIn(c.id)[0]);
    heading = '各类第一名';
  }
  // Venues that actually serve this meal come first.
  const ordered = [...pool.filter((r) => servesMeal(r, meal)), ...pool.filter((r) => !servesMeal(r, meal))];
  const shown = ordered.slice(0, searching ? 8 : SUGGESTIONS);
  const mealLabel = MEALS.find((m) => m.key === meal)!.label;
  const inputId = `picker-q-${day}`;

  return (
    <div className="picker">
      <div className="picker__head">
        <span className="picker__title">从榜单挑一家</span>
        {openMeals.length > 1 && <Segmented label="哪一餐" options={MEAL_OPTIONS} value={meal} onChange={onMeal} />}
        {openMeals.length === 1 && <span className="pill">{mealLabel}</span>}
      </div>
      <label className="field" htmlFor={inputId}>
        搜索餐厅、菜系或区域
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
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
                  {categoryOf(r.category).short} · {r.suburb} · {r.price}
                  {r.badges[0] ? ` · ${r.badges[0]}` : ''}
                  {!servesMeal(r, meal) ? ` · 通常不做${mealLabel}` : ''}
                </span>
              </div>
              <button type="button" className="btn btn--primary" aria-label={`${mealLabel}选 ${r.name}`} onClick={() => onPick(r, meal)}>
                选这家
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="linkish" onClick={onCustom}>
        不在榜单里？手动添加一家
      </button>
    </div>
  );
}

interface CustomProps {
  openMeals: Meal[];
  initialMeal: Meal;
  onCancel: () => void;
  onSave: (meal: Meal, name: string, note: string) => void;
}

function CustomForm({ openMeals, initialMeal, onCancel, onSave }: CustomProps) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const options = MEAL_OPTIONS.filter((o) => openMeals.includes(o.value));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(meal, name.trim(), note.trim());
  };

  return (
    <form className="custom" onSubmit={submit}>
      <span className="picker__title">手动添加一家店</span>
      {options.length > 1 && <Segmented label="哪一餐" options={options} value={meal} onChange={setMeal} />}
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
