import { useState } from 'react';
import { CATEGORIES, categoryOf, restaurantsIn } from '../data/restaurants';
import { MONTH_INDEX, YEAR } from '../data/december';
import type { CategoryId, Meal, Price, Restaurant } from '../data/types';
import { dateLabel } from '../lib/calendar';
import { MEALS, freeSydneyDays, servesMeal, type Picks } from '../lib/plan';
import { PlusIcon } from './Icons';
import { Segmented } from './Segmented';

export type BoardCategory = 'all' | CategoryId;
type PriceFilter = 'all' | Price;

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: 'all', label: '全部价位' },
  { value: '$', label: '$' },
  { value: '$$', label: '$$' },
  { value: '$$$', label: '$$$' },
  { value: '$$$$', label: '$$$$' },
];

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.label }));
const COLLAPSED_ROWS = 6;

function rankLabel(rank: number): string {
  return rank < 10 ? `0${rank}` : `${rank}`;
}

interface BoardProps {
  category: BoardCategory;
  onCategory: (c: BoardCategory) => void;
  picks: Picks;
  onAdd: (restaurant: Restaurant, day: number, meal: Meal) => void;
}

export function RestaurantBoard({ category, onCategory, picks, onAdd }: BoardProps) {
  const [price, setPrice] = useState<PriceFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addMeal, setAddMeal] = useState<Meal>('dinner');

  const priceOk = (r: Restaurant) => price === 'all' || r.price === price;
  const total = CATEGORIES.reduce((n, c) => n + restaurantsIn(c.id).length, 0);

  const pickCategory = (c: BoardCategory) => {
    onCategory(c);
    setExpanded(false);
    setAddingId(null);
  };

  const list = category === 'all' ? [] : restaurantsIn(category).filter(priceOk);
  const visible = expanded ? list : list.slice(0, COLLAPSED_ROWS);

  return (
    <section id="list" aria-labelledby="list-h" className="board">
      <div className="section-head">
        <div className="section-head__text">
          <h1 id="list-h">悉尼餐厅榜单</h1>
          <p>
            按类别排名，综合 2026 SMH Good Food Guide、AGFG 厨师帽、World’s 101 Best Steak、Gourmet Traveller 百佳与 Broadsheet / Time Out
            推荐。只收录目前仍在营业的店。
          </p>
        </div>
        <Segmented label="按价位筛选" variant="pill" options={PRICE_OPTIONS} value={price} onChange={setPrice} />
      </div>

      <div role="group" aria-label="按类别查看" className="tabs">
        <button type="button" className="tab" aria-pressed={category === 'all'} onClick={() => pickCategory('all')}>
          <span>全部</span>
          <span className="tab__count">{total}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className="tab" aria-pressed={category === c.id} onClick={() => pickCategory(c.id)}>
            <span>{c.name}</span>
            <span className="tab__count">{restaurantsIn(c.id).length}</span>
          </button>
        ))}
      </div>

      {category === 'all' ? (
        <div className="blocks">
          {CATEGORIES.map((c) => {
            const all = restaurantsIn(c.id);
            const top = all.filter(priceOk).slice(0, 3);
            return (
              <article key={c.id} className="block" aria-labelledby={`block-${c.id}`}>
                <div className="block__head">
                  <h2 id={`block-${c.id}`}>{c.name}</h2>
                  <span>共 {all.length} 家</span>
                </div>
                {top.length ? (
                  <ol className="block__list">
                    {top.map((r) => (
                      <li key={r.id}>
                        <span className={`rank${r.rank === 1 ? ' rank--first' : ''}`}>{rankLabel(r.rank)}</span>
                        <div className="block__item">
                          <span className="block__name">{r.name}</span>
                          <span className="muted">
                            {r.suburb} · {r.price}
                          </span>
                          {r.badges[0] && <span className="badge">{r.badges[0]}</span>}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">这个价位暂时没有。</p>
                )}
                <button type="button" className="btn btn--outline block__more" onClick={() => pickCategory(c.id)}>
                  看全部 {all.length} 家
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <>
          {visible.length ? (
            <ol className="rows" aria-label={`${categoryOf(category).name}排名`}>
              {visible.map((r) => (
                <RestaurantRow
                  key={r.id}
                  restaurant={r}
                  adding={addingId === r.id}
                  onToggleAdd={() => setAddingId(addingId === r.id ? null : r.id)}
                  addMeal={addMeal}
                  onAddMeal={setAddMeal}
                  freeDays={addingId === r.id ? freeSydneyDays(addMeal, picks) : []}
                  onPickDay={(day) => {
                    onAdd(r, day, addMeal);
                    setAddingId(null);
                  }}
                />
              ))}
            </ol>
          ) : (
            <p className="empty">这个价位暂时没有{categoryOf(category).name}。</p>
          )}
          {list.length > COLLAPSED_ROWS && (
            <button type="button" className="btn btn--outline btn--round expand" onClick={() => setExpanded(!expanded)}>
              {expanded ? '收起' : `展开其余 ${list.length - COLLAPSED_ROWS} 家`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

interface RowProps {
  restaurant: Restaurant;
  adding: boolean;
  onToggleAdd: () => void;
  addMeal: Meal;
  onAddMeal: (m: Meal) => void;
  freeDays: number[];
  onPickDay: (day: number) => void;
}

function RestaurantRow({ restaurant: r, adding, onToggleAdd, addMeal, onAddMeal, freeDays, onPickDay }: RowProps) {
  const popId = `add-${r.id}`;
  const mealLabel = MEALS.find((m) => m.key === addMeal)!.label;
  return (
    <li className="row">
      <div className="row__main">
        <span className={`rank rank--big${r.rank === 1 ? ' rank--first' : ''}`}>{rankLabel(r.rank)}</span>
        <div className="row__body">
          <div className="row__title">
            <h3>{r.name}</h3>
            {r.nameZh && <span className="row__zh">{r.nameZh}</span>}
            <span className="muted">
              {r.suburb} · {r.price}
            </span>
          </div>
          <div className="chips">
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
          <p className="row__intro">{r.intro}</p>
          <span className="muted small">订位：{r.booking}</span>
          {r.sources.length > 0 && (
            <details className="sources">
              <summary>评价依据（{r.sources.length}）</summary>
              {r.accolades.length > 0 && (
                <ul>
                  {r.accolades.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              <ul className="sources__links">
                {r.sources.map((s) => (
                  <li key={s}>
                    <a href={s} target="_blank" rel="noreferrer">
                      {new URL(s).hostname.replace(/^www\./, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="row__action">
          <button type="button" className="btn btn--primary" aria-expanded={adding} aria-controls={popId} onClick={onToggleAdd}>
            <PlusIcon />
            <span>加入日历</span>
          </button>
        </div>
      </div>
      {adding && (
        <div id={popId} className="addpop" role="region" aria-label={`把 ${r.name} 加入日历`}>
          <div className="addpop__head">
            <span className="addpop__title">加到哪一天？</span>
            <Segmented label="哪一餐" options={MEAL_OPTIONS} value={addMeal} onChange={onAddMeal} />
            <span className="muted small">只列出人在悉尼、这一餐还空着的日子</span>
          </div>
          {!servesMeal(r, addMeal) && <p className="warn">提示：这家通常不做{mealLabel}，去之前确认一下营业时间。</p>}
          {freeDays.length ? (
            <div className="addpop__days">
              {freeDays.map((d) => (
                <button key={d} type="button" className="btn btn--ghost" onClick={() => onPickDay(d)}>
                  {dateLabel(YEAR, MONTH_INDEX, d)}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">在悉尼的日子{mealLabel}都安排满了。</p>
          )}
        </div>
      )}
    </li>
  );
}
