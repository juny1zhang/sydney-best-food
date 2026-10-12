import { useRef, useState } from 'react';
import { CATEGORIES, categoryOf, restaurantsIn } from '../data/restaurants';
import type { CategoryId, Meal, Price, Restaurant } from '../data/types';
import { hostOf } from '../lib/url';
import { useGridColumns } from '../hooks/useGridColumns';
import { freeSydneyDays, placementsOf, type Picks } from '../lib/plan';
import { AddPopover } from './AddPopover';
import { PlusIcon } from './Icons';
import { Segmented } from './Segmented';
import { TaChip, XhsChip } from './Reviews';
import { detailHref } from '../lib/route';

export type BoardCategory = 'all' | CategoryId;
type PriceFilter = 'all' | Price;

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: 'all', label: '全部价位' },
  { value: '$', label: '$' },
  { value: '$$', label: '$$' },
  { value: '$$$', label: '$$$' },
  { value: '$$$$', label: '$$$$' },
];

const COLLAPSED_ROWS = 6;
/** Collapsed, the overview shows one row of category cards, and never fewer than this. */
const MIN_COLLAPSED_BLOCKS = 2;

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
  const [allBlocks, setAllBlocks] = useState(false);
  const [blocksEl, setBlocksEl] = useState<HTMLDivElement | null>(null);
  const columns = useGridColumns(blocksEl, 3);
  const collapsedBlocks = Math.max(columns, MIN_COLLAPSED_BLOCKS);
  const sectionRef = useRef<HTMLElement>(null);

  const priceOk = (r: Restaurant) => price === 'all' || r.price === price;
  const countIn = (id: CategoryId) => restaurantsIn(id).filter(priceOk).length;
  const total = CATEGORIES.reduce((n, c) => n + countIn(c.id), 0);

  /** The list height changes a lot between views; bring the board's top back into view. */
  const settle = (focusSelector?: string) => {
    requestAnimationFrame(() => {
      const el = sectionRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView?.({ block: 'start' });
      if (focusSelector) el?.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    });
  };

  const pickCategory = (c: BoardCategory, fromBlock = false) => {
    onCategory(c);
    setExpanded(false);
    setAddingId(null);
    settle(fromBlock ? '.tabs [aria-pressed="true"]' : undefined);
  };

  const list = category === 'all' ? [] : restaurantsIn(category).filter(priceOk);
  const visible = expanded ? list : list.slice(0, COLLAPSED_ROWS);
  const listHeadingId = 'list-cat-h';

  return (
    <section id="list" ref={sectionRef} aria-labelledby="list-h" className="board">
      <div className="section-head">
        <div className="section-head__text">
          <h1 id="list-h">悉尼餐厅榜单</h1>
          <p>
            按类别排名，综合 2026 SMH Good Food Guide、AGFG 厨师帽、World’s 101 Best Steak、Gourmet Traveller 百佳与 Broadsheet / Time Out
            推荐。只收录目前仍在营业的店。
          </p>
        </div>
        <Segmented
          label="按价位筛选"
          variant="pill"
          options={PRICE_OPTIONS}
          value={price}
          onChange={(p) => {
            setPrice(p);
            setAddingId(null);
          }}
        />
      </div>

      <div role="group" aria-label="按类别查看" className="tabs">
        <button type="button" className="tab" aria-pressed={category === 'all'} onClick={() => pickCategory('all')}>
          <span>全部</span>
          <span className="tab__count">{total}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className="tab" aria-pressed={category === c.id} onClick={() => pickCategory(c.id)}>
            <span>{c.name}</span>
            <span className="tab__count">{countIn(c.id)}</span>
          </button>
        ))}
      </div>

      {category === 'all' ? (
        <>
        <div className="blocks" id="blocks" ref={setBlocksEl}>
          {(allBlocks ? CATEGORIES : CATEGORIES.slice(0, collapsedBlocks)).map((c) => {
            const all = restaurantsIn(c.id);
            const matching = all.filter(priceOk);
            const top = matching.slice(0, 3);
            return (
              <article key={c.id} className="block" aria-labelledby={`block-${c.id}`}>
                <div className="block__head">
                  <h2 id={`block-${c.id}`}>{c.name}</h2>
                  <span>{price === 'all' ? `共 ${all.length} 家` : `${matching.length} 家 · 共 ${all.length} 家`}</span>
                </div>
                {top.length ? (
                  <ol className="block__list">
                    {top.map((r) => (
                      <li key={r.id}>
                        <span className={`rank${r.rank === 1 ? ' rank--first' : ''}`}>{rankLabel(r.rank)}</span>
                        <div className="block__item">
                          <a className="block__name" href={detailHref(r.id)}>
                            {r.name}
                          </a>
                          <span className="muted">
                            {r.suburb} · {r.price}
                          </span>
                          <span className="block__chips">
                            {r.badges[0] && <span className="badge">{r.badges[0]}</span>}
                            <XhsChip restaurant={r} />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">这个价位暂时没有。</p>
                )}
                {matching.length > 0 && (
                  <button type="button" className="btn btn--outline block__more" onClick={() => pickCategory(c.id, true)}>
                    看全部 {matching.length} 家
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {CATEGORIES.length > collapsedBlocks && (
          <button
            type="button"
            className="btn btn--outline btn--round expand"
            aria-expanded={allBlocks}
            aria-controls="blocks"
            onClick={() => {
              if (allBlocks) settle();
              setAllBlocks(!allBlocks);
            }}
          >
            {allBlocks ? '收起' : `展开其余 ${CATEGORIES.length - collapsedBlocks} 个类别`}
          </button>
        )}
        </>
      ) : (
        <>
          <h2 id={listHeadingId} className="list-heading">
            {categoryOf(category).name}排名
            {price !== 'all' && <span className="muted"> · {price}</span>}
          </h2>
          {visible.length ? (
            <ol className="rows" aria-labelledby={listHeadingId}>
              {visible.map((r) => (
                <RestaurantRow
                  key={r.id}
                  restaurant={r}
                  placements={placementsOf(r.id, picks)}
                  adding={addingId === r.id}
                  onToggleAdd={() => setAddingId(addingId === r.id ? null : r.id)}
                  addMeal={addMeal}
                  onAddMeal={setAddMeal}
                  freeDays={addingId === r.id ? freeSydneyDays(addMeal, picks) : []}
                  onPickDay={(day) => {
                    onAdd(r, day, addMeal);
                    setAddingId(null);
                    requestAnimationFrame(() => document.getElementById(`addbtn-${r.id}`)?.focus({ preventScroll: true }));
                  }}
                />
              ))}
            </ol>
          ) : (
            <div className="empty">
              <p>这个价位暂时没有{categoryOf(category).name}。</p>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  setPrice('all');
                  requestAnimationFrame(() =>
                    sectionRef.current?.querySelector<HTMLElement>('.segmented--pill [aria-pressed="true"]')?.focus({ preventScroll: true }),
                  );
                }}
              >
                查看全部价位
              </button>
            </div>
          )}
          {list.length > COLLAPSED_ROWS && (
            <button
              type="button"
              className="btn btn--outline btn--round expand"
              onClick={() => {
                if (expanded) {
                  setAddingId(null);
                  settle();
                }
                setExpanded(!expanded);
              }}
            >
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
  placements: string[];
  adding: boolean;
  onToggleAdd: () => void;
  addMeal: Meal;
  onAddMeal: (m: Meal) => void;
  freeDays: number[];
  onPickDay: (day: number) => void;
}

function RestaurantRow({ restaurant: r, placements, adding, onToggleAdd, addMeal, onAddMeal, freeDays, onPickDay }: RowProps) {
  const popId = `add-${r.id}`;
  return (
    <li className="row">
      <div className="row__main">
        <span className={`rank rank--big${r.rank === 1 ? ' rank--first' : ''}`}>{rankLabel(r.rank)}</span>
        <div className="row__body">
          <div className="row__title">
            <h3>
              <a href={detailHref(r.id)}>{r.name}</a>
            </h3>
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
            <XhsChip restaurant={r} />
            <TaChip restaurant={r} />
            {r.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          <p className="row__intro">{r.intro}</p>
          <span className="muted small">订位：{r.booking}</span>
          {placements.length > 0 && <span className="placed">已在日历：{placements.join('、')}</span>}
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
                      {hostOf(s)}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="row__action">
          <button
            id={`addbtn-${r.id}`}
            type="button"
            className="btn btn--primary"
            aria-expanded={adding}
            aria-controls={popId}
            onClick={onToggleAdd}
          >
            <PlusIcon />
            <span>加入日历</span>
          </button>
        </div>
      </div>
      {adding && <AddPopover id={popId} restaurant={r} meal={addMeal} onMeal={onAddMeal} freeDays={freeDays} onPickDay={onPickDay} />}
    </li>
  );
}
