import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MONTH_INDEX, YEAR, dayInfo } from '../data/december';
import { searchNz, townOf, townsFor, venuesForDay } from '../data/nz';
import { PLACE_BY_ID } from '../data/places';
import { CATEGORIES, categoryOf, mapsSearchUrl, mapsUrl, restaurantsIn, searchRestaurants } from '../data/restaurants';
import type { Meal, Place } from '../data/types';
import { dateLabel } from '../lib/calendar';
import { MEALS, defaultTime, mealEntry, mealLabel, servesMeal, type MealEntry, type Pick, type Picks, type Reservation } from '../lib/plan';
import { detailHref } from '../lib/route';
import { RESERVATION_NOTE_MAX } from '../lib/storage';
import type { BoardCategory } from './RestaurantBoard';
import { mealsLeft } from './Calendar';
import { PinIcon } from './Icons';
import { Segmented } from './Segmented';
import { Sources } from './Sources';

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.label }));
const SUGGESTIONS = 5;

function places(ids: string[]): Place[] {
  return ids.map((id) => PLACE_BY_ID.get(id)).filter((p): p is Place => !!p);
}

interface PanelProps {
  day: number;
  picks: Picks;
  boardCategory: BoardCategory;
  wishlist: string[];
  titleId: string;
  onChoose: (day: number, meal: Meal, pick: Pick) => void;
  onClear: (day: number, meal: Meal) => void;
  onReserve: (day: number, meal: Meal, reservation: Reservation | null) => void;
}

export function DayPanel({ day, picks, boardCategory, wishlist, titleId, onChoose, onClear, onReserve }: PanelProps) {
  const info = dayInfo(day);
  const open = mealsLeft(day, picks);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [meal, setMeal] = useState<Meal>(open.includes('dinner') || !open.length ? 'dinner' : open[0]);
  const [replacing, setReplacing] = useState<Meal | null>(null);
  const [reserving, setReserving] = useState<Meal | null>(null);
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

  const scope: 'syd' | 'nz' | null =
    info.region === 'syd' ? 'syd' : info.region === 'nz' && venuesForDay(day).length > 0 ? 'nz' : null;
  const showPicker = scope !== null && target !== null && !customOpen;
  const showElsewhere = scope === null && target !== null && !customOpen;

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
          day={day}
          meal={m.key}
          entry={mealEntry(day, m.key, picks)}
          replacing={replacing === m.key}
          reserving={reserving === m.key}
          regionNote={
            scope === 'syd'
              ? '还空着，可以在下面挑一家。'
              : scope === 'nz'
                ? '还空着，可以从下面的当地推荐里挑。'
                : info.region === 'nz'
                  ? '还没定。'
                  : '这天还没有计划。'
          }
          onReplace={() => {
            setReplacing(m.key);
            setReserving(null);
            setMeal(m.key);
            setCustomOpen(false);
            requestAnimationFrame(() => document.getElementById(`picker-q-${day}`)?.focus());
          }}
          onClear={() => {
            onClear(day, m.key);
            setReplacing(null);
            setReserving(null);
            setMeal(m.key);
            refocus();
          }}
          onStartReserve={() => setReserving(m.key)}
          onSaveReserve={(res) => {
            onReserve(day, m.key, res);
            setReserving(null);
            refocus();
          }}
          onCancelReserve={() => {
            setReserving(null);
            refocus();
          }}
          onUnreserve={() => {
            onReserve(day, m.key, null);
            refocus();
          }}
        />
      ))}

      {showPicker && (
        <Picker
          day={day}
          scope={scope}
          meal={target}
          writable={writable}
          replacing={replacing !== null}
          onMeal={setMeal}
          query={query}
          onQuery={setQuery}
          boardCategory={boardCategory}
          wishlist={wishlist}
          onPick={(p) => choose(target, { kind: 'restaurant', id: p.id })}
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
  day: number;
  meal: Meal;
  entry: MealEntry | null;
  replacing: boolean;
  reserving: boolean;
  regionNote: string;
  onReplace: () => void;
  onClear: () => void;
  onStartReserve: () => void;
  onSaveReserve: (r: Reservation) => void;
  onCancelReserve: () => void;
  onUnreserve: () => void;
}

function MealSlot(props: SlotProps) {
  const { day, meal, entry, replacing, reserving, regionNote } = props;
  const label = mealLabel(meal);

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

  const reserved = entry.reserved;
  const name = entry.status === 'picked' ? entry.place.name : entry.pick.name;
  const pill = reserved ? (
    <span className="pill pill--booked">已预订 · {reserved.time}</span>
  ) : (
    <span className="pill pill--picked">{replacing ? '正在换' : '已选好'}</span>
  );

  const reserveArea = reserving ? (
    <ReserveForm
      day={day}
      meal={meal}
      initial={reserved}
      onSave={props.onSaveReserve}
      onCancel={props.onCancelReserve}
    />
  ) : (
    !replacing && (
      <div className="slot__actions">
        {reserved ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={props.onStartReserve} aria-label={`修改订位：${label}`}>
              修改订位
            </button>
            <button type="button" className="btn btn--ghost" onClick={props.onUnreserve} aria-label={`取消已订：${label}`}>
              取消已订
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--reserve" onClick={props.onStartReserve} aria-label={`标记已订位：${label}`}>
            标记已订位
          </button>
        )}
        {entry.status === 'picked' && !reserved && (
          <button type="button" className="btn btn--ghost" onClick={props.onReplace} aria-label={`换一家：${label}`}>
            换一家
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={props.onClear} aria-label={`删除：${label} ${name}`}>
          删除
        </button>
      </div>
    )
  );

  if (entry.status === 'custom') {
    return (
      <div className="slot">
        <div className="slot__head">
          <span className="slot__label">{label}</span>
          {pill}
        </div>
        <div className="slot__name">
          <span>{entry.pick.name}</span>
          <span className="muted">自己记的</span>
        </div>
        {entry.pick.note && <p className="slot__intro">{entry.pick.note}</p>}
        {reserved?.note && <span className="muted small">订位备注：{reserved.note}</span>}
        {reserveArea}
      </div>
    );
  }

  const p = entry.place;
  return (
    <div className="slot">
      <div className="slot__head">
        <span className="slot__label">{label}</span>
        {pill}
      </div>
      <div className="slot__name">
        <span>{p.name}</span>
        <span className="muted">
          {p.nameZh ? `${p.nameZh} · ` : ''}
          {p.area} · {p.price}
        </span>
      </div>
      <div className="chips">
        <span className={`chip-cat ${reserved ? 'chip-cat--booked' : 'chip-cat--picked'}`}>{p.categoryLabel}</span>
        {p.badges.map((b) => (
          <span key={b} className="badge">
            {b}
          </span>
        ))}
        {p.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <p className="slot__intro">{p.intro}</p>
      {reserved ? (
        reserved.note && <span className="muted small">订位备注：{reserved.note}</span>
      ) : (
        <span className="muted small">订位：{p.booking}</span>
      )}
      {!servesMeal(p, meal) && <p className="warn">提示：这家通常不做{label}，去之前确认一下营业时间。</p>}
      <Sources sources={p.sources} accolades={p.accolades} />
      <div className="slot__links">
        {p.region === 'syd' && <a href={detailHref(p.id)}>菜单和招牌菜</a>}
        <a href={mapsSearchUrl(p.mapsQuery)} target="_blank" rel="noreferrer">
          在地图中打开
        </a>
        {p.website && (
          <a href={p.website} target="_blank" rel="noreferrer">
            官网
          </a>
        )}
      </div>
      {reserveArea}
    </div>
  );
}

interface ReserveProps {
  day: number;
  meal: Meal;
  initial?: Reservation;
  onSave: (r: Reservation) => void;
  onCancel: () => void;
}

function ReserveForm({ day, meal, initial, onSave, onCancel }: ReserveProps) {
  const [time, setTime] = useState(initial?.time ?? defaultTime(day, meal));
  const [note, setNote] = useState(initial?.note ?? '');
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const timeId = `reserve-time-${day}-${meal}`;
  const noteId = `reserve-note-${day}-${meal}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onSave({ time, note: note.trim() });
  };

  return (
    <form className="reserve" onSubmit={submit} aria-label={`${mealLabel(meal)}订位信息`}>
      <div className="reserve__fields">
        <label className="field" htmlFor={timeId}>
          订到几点
          <input id={timeId} type="time" value={time} onChange={(e) => setTime(e.target.value)} required autoFocus />
        </label>
        <label className="field reserve__note" htmlFor={noteId}>
          备注（可选）
          <input
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={RESERVATION_NOTE_MAX}
            placeholder="比如：2 位，订位号 1234"
          />
        </label>
      </div>
      <div className="custom__actions">
        <button type="submit" className="btn btn--primary" disabled={!valid}>
          保存
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

interface PickerProps {
  day: number;
  scope: 'syd' | 'nz';
  meal: Meal;
  writable: Meal[];
  replacing: boolean;
  onMeal: (m: Meal) => void;
  query: string;
  onQuery: (q: string) => void;
  boardCategory: BoardCategory;
  wishlist: string[];
  onPick: (p: Place) => void;
  onCancelReplace: () => void;
  onCustom: () => void;
}

function sydneyPool(boardCategory: BoardCategory, wishlist: string[]): { pool: Place[]; source: string } {
  const wished = places(wishlist).filter((p) => p.region === 'syd');
  if (boardCategory !== 'all' && boardCategory !== 'wish') {
    const pool = places(restaurantsIn(boardCategory).map((r) => r.id));
    return { pool, source: `${categoryOf(boardCategory).name}榜单 ${pool.length} 家` };
  }
  const leaders = places(CATEGORIES.map((c) => restaurantsIn(c.id)[0].id));
  if (boardCategory === 'wish' && wished.length) return { pool: wished, source: `想去的 ${wished.length} 家` };
  if (!wished.length) return { pool: leaders, source: `各类第一名 ${leaders.length} 家` };
  const rest = leaders.filter((p) => !wishlist.includes(p.id));
  return { pool: [...wished, ...rest], source: `想去的 ${wished.length} 家和各类第一名` };
}

function Picker(props: PickerProps) {
  const { day, scope, meal, writable, replacing, onMeal, query, onQuery, boardCategory, wishlist, onPick, onCancelReplace, onCustom } = props;
  const [showAll, setShowAll] = useState(false);
  const [lucky, setLucky] = useState<string | null>(null);
  const searching = query.trim().length > 0;
  const label = mealLabel(meal);

  let pool: Place[];
  let source: string;
  if (scope === 'nz') {
    if (searching) {
      pool = places(searchNz(query).map((v) => v.id));
      source = `新西兰沿途找到 ${pool.length} 家`;
    } else {
      pool = places(venuesForDay(day, meal).map((v) => v.id));
      const towns = townsFor(day, meal)
        .map((t) => townOf(t).name)
        .join('、');
      source = `${towns}的推荐 ${pool.length} 家`;
    }
  } else if (searching) {
    pool = places(searchRestaurants(query).map((r) => r.id));
    source = `找到 ${pool.length} 家`;
  } else {
    ({ pool, source } = sydneyPool(boardCategory, wishlist));
  }

  // Keep the list's order, but venues that serve this meal come first.
  let ordered = [...pool.filter((p) => servesMeal(p, meal)), ...pool.filter((p) => !servesMeal(p, meal))];
  const luckyPlace = lucky ? ordered.find((p) => p.id === lucky) : undefined;
  if (luckyPlace) ordered = [luckyPlace, ...ordered.filter((p) => p.id !== luckyPlace.id)];
  const shown = showAll ? ordered : ordered.slice(0, SUGGESTIONS);
  const heading = !pool.length
    ? scope === 'nz'
      ? '没找到，换个关键词试试，比如“汉堡”“咖啡”“皇后镇”'
      : '没找到，换个关键词试试，比如“烤鸭”“pizza”“Surry Hills”'
    : `${source}，做${label}的排在前面${shown.length < pool.length ? `，先显示 ${shown.length} 家` : ''}`;
  const inputId = `picker-q-${day}`;

  const roll = () => {
    const candidates = ordered.filter((p) => servesMeal(p, meal));
    const from = (candidates.length ? candidates : ordered).filter((p) => p.id !== lucky);
    if (!from.length) return;
    setLucky(from[Math.floor(Math.random() * from.length)].id);
    setShowAll(false);
  };

  return (
    <div className="picker">
      <div className="picker__head">
        <span className="picker__title">{replacing ? `给${label}换一家` : scope === 'nz' ? '当地推荐' : '从榜单挑一家'}</span>
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
            setLucky(null);
          }}
          placeholder={scope === 'nz' ? '例如：汉堡、咖啡、皇后镇' : '例如：烤鸭、omakase、Surry Hills'}
          autoComplete="off"
        />
      </label>
      <div className="picker__bar">
        <span className="muted small" aria-live="polite">
          {heading}
        </span>
        {ordered.length > 1 && (
          <button type="button" className="linkish" onClick={roll}>
            {lucky ? '再随机一家' : '随机挑一家'}
          </button>
        )}
      </div>
      {shown.length > 0 && (
        <ul className="picker__list">
          {shown.map((p) => (
            <li key={p.id} className={p.id === luckyPlace?.id ? 'picker__lucky' : undefined}>
              <div className="picker__item">
                <span className="picker__name">
                  {p.id === luckyPlace?.id && <span className="picker__flag">随机挑中</span>}
                  {wishlist.includes(p.id) && <span className="picker__flag picker__flag--wish">想去</span>}
                  {p.name}
                </span>
                <span className="muted small">
                  {p.region === 'syd' ? `${p.rankLabel} · ${p.area}` : `${p.categoryLabel} · ${p.area}`} · {p.price}
                  {p.badges[0] ? ` · ${p.badges[0]}` : ''}
                </span>
                {!servesMeal(p, meal) && <span className="picker__warn">通常不做{label}</span>}
              </div>
              <button type="button" className="btn btn--primary" aria-label={`选这家：${p.name}（${label}）`} onClick={() => onPick(p)}>
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
          {scope === 'nz' ? '不在推荐里？手动添加一家' : '不在榜单里？手动添加一家'}
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
