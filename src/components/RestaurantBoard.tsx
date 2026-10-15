import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CATEGORIES, categoryOf, restaurantsIn, searchRestaurants, sortRestaurants, type SortOrder } from '../data/restaurants';
import type { CategoryId, Meal, Price, Restaurant } from '../data/types';
import { hostOf } from '../lib/url';
import { useGridColumns } from '../hooks/useGridColumns';
import { usePersistentState } from '../hooks/usePersistentState';
import { defaultMeal, freeSydneyDays, placementsOf, type Picks } from '../lib/plan';
import { AddPopover } from './AddPopover';
import { CloseIcon, PlusIcon } from './Icons';
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

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'rank', label: '默认排名' },
  { value: 'xhs', label: '小红书口碑' },
  { value: 'ta', label: 'TripAdvisor 评分' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
];

/** Where the board's choices are remembered between visits. */
export const BOARD_KEYS = {
  category: 'sydney-eats:board:category',
  price: 'sydney-eats:board:price',
  sort: 'sydney-eats:board:sort',
} as const;

const BOARD_CATEGORIES: BoardCategory[] = ['all', ...CATEGORIES.map((c) => c.id)];
const PRICE_VALUES = PRICE_OPTIONS.map((o) => o.value);
const SORT_VALUES = SORT_OPTIONS.map((o) => o.value);

/** The board's category tab, remembered across reloads. */
export function useBoardCategory() {
  return usePersistentState<BoardCategory>(BOARD_KEYS.category, 'all', BOARD_CATEGORIES);
}

const COLLAPSED_ROWS = 6;
/** Collapsed, the overview shows one row of category cards, and never fewer than this. */
const MIN_COLLAPSED_BLOCKS = 2;
const ROWS_ID = 'board-rows';

function rankLabel(rank: number): string {
  return rank < 10 ? `0${rank}` : `${rank}`;
}

function SearchGlyph() {
  return (
    <svg className="board-search__icon" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

interface BoardProps {
  category: BoardCategory;
  onCategory: (c: BoardCategory) => void;
  picks: Picks;
  onAdd: (restaurant: Restaurant, day: number, meal: Meal) => void;
}

export function RestaurantBoard({ category, onCategory, picks, onAdd }: BoardProps) {
  const [price, setPrice] = usePersistentState<PriceFilter>(BOARD_KEYS.price, 'all', PRICE_VALUES);
  const [sort, setSort] = usePersistentState<SortOrder>(BOARD_KEYS.sort, 'rank', SORT_VALUES);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addMeal, setAddMeal] = useState<Meal>('dinner');
  /** The meal the user last chose; a popover opens on it unless that place doesn't serve it. */
  const [preferredMeal, setPreferredMeal] = useState<Meal>('dinner');
  const [allBlocks, setAllBlocks] = useState(false);
  const [blocksEl, setBlocksEl] = useState<HTMLDivElement | null>(null);
  const columns = useGridColumns(blocksEl, 3);
  const collapsedBlocks = Math.max(columns, MIN_COLLAPSED_BLOCKS);
  const sectionRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const searching = query.trim().length > 0;
  const results = searching ? searchRestaurants(query) : [];
  const matched = new Set(results.map((r) => r.id));
  const priceOk = (r: Restaurant) => price === 'all' || r.price === price;
  const shown = (r: Restaurant) => priceOk(r) && (!searching || matched.has(r.id));
  const countIn = (id: CategoryId) => restaurantsIn(id).filter(shown).length;
  const total = CATEGORIES.reduce((n, c) => n + countIn(c.id), 0);

  /** The list height changes a lot between views; bring the board's top back into view. */
  const settle = (focusSelector?: string) => {
    requestAnimationFrame(() => {
      const el = sectionRef.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView?.({ block: 'start' });
      if (focusSelector) el?.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    });
  };

  // On phones the tabs scroll sideways; keep the chosen one in view, including a later tab remembered from last time.
  useEffect(() => {
    sectionRef.current?.querySelector<HTMLElement>('.tabs [aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [category]);

  const pickCategory = (c: BoardCategory, moveFocus = false) => {
    onCategory(c);
    setExpanded(false);
    setAddingId(null);
    settle(moveFocus ? '.tabs [aria-pressed="true"]' : undefined);
  };

  const changeQuery = (q: string) => {
    setQuery(q);
    setExpanded(false);
    setAddingId(null);
  };

  const clearSearch = () => {
    changeQuery('');
    searchRef.current?.focus();
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && query) {
      e.preventDefault();
      changeQuery('');
    }
  };

  const showAllPrices = () => {
    setPrice('all');
    setAddingId(null);
    requestAnimationFrame(() =>
      sectionRef.current?.querySelector<HTMLElement>('.segmented--pill [aria-pressed="true"]')?.focus({ preventScroll: true }),
    );
  };

  // With a query, "全部" turns into one list across categories; a category tab just narrows its own list.
  const flat = category === 'all' && searching;
  const list =
    category === 'all' ? (flat ? sortRestaurants(results.filter(priceOk), sort) : []) : sortRestaurants(restaurantsIn(category).filter(shown), sort);
  const visible = expanded ? list : list.slice(0, COLLAPSED_ROWS);
  const listHeadingId = 'list-cat-h';

  const scope = category === 'all' ? '' : `${categoryOf(category).name}里`;
  const only = price === 'all' ? '' : ` · 只看 ${price}`;
  const status = !searching ? '' : list.length ? `${scope}找到 ${list.length} 家${only}` : `${scope}没有相关的店${only}`;
  /** For the empty state: what the query finds once the category or the price is let go. */
  const inAllCategories = results.filter(priceOk).length;
  const atAnyPrice = results.filter((r) => category === 'all' || r.category === category).length;

  return (
    <section id="list" ref={sectionRef} aria-labelledby="list-h" className="board">
      <div className="section-head">
        <div className="section-head__text">
          <h1 id="list-h">悉尼餐厅榜单</h1>
          <p>
            按类别排名。多数类别综合 SMH Good Food Guide、AGFG 厨师帽、Gourmet Traveller、World’s 101 Best Steak、50 Top Pizza 与 Broadsheet / Time Out
            的榜单和评测；火锅、烤肉和另外几家榜单没收录的店，主要看小红书推荐和 Google 地图等网友评价。只收录目前仍在营业的店。
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

      <div className="board__tools">
        <div className="board-search" role="search">
          <SearchGlyph />
          <input
            ref={searchRef}
            type="search"
            aria-label="搜索榜单"
            placeholder="店名、菜系或区域，如 烤鸭、pizza"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            onKeyDown={onSearchKey}
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && (
            <button type="button" className="board-search__clear" aria-label="清空搜索框" onClick={clearSearch}>
              <CloseIcon size={16} />
            </button>
          )}
        </div>
        <p className="board__status" aria-live="polite">
          {status}
        </p>
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

      {category === 'all' && !searching ? (
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
                            {r.nameZh && `${r.nameZh} · `}
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
          <div className="list-head">
            <h2 id={listHeadingId} className="list-heading">
              {category === 'all' ? '搜索结果' : `${categoryOf(category).name}排名`}
              {price !== 'all' && <span className="muted"> · {price}</span>}
            </h2>
            <label className="sort">
              排序
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortOrder);
                  setAddingId(null);
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {visible.length ? (
            <ol className="rows" id={ROWS_ID} aria-labelledby={listHeadingId}>
              {visible.map((r) => (
                <RestaurantRow
                  key={r.id}
                  restaurant={r}
                  showCategory={flat}
                  placements={placementsOf(r.id, picks)}
                  adding={addingId === r.id}
                  onToggleAdd={() => {
                    if (addingId === r.id) {
                      setAddingId(null);
                      return;
                    }
                    setAddMeal(defaultMeal(r, preferredMeal));
                    setAddingId(r.id);
                  }}
                  addMeal={addMeal}
                  onAddMeal={(m) => {
                    setAddMeal(m);
                    setPreferredMeal(m);
                  }}
                  freeDays={addingId === r.id ? freeSydneyDays(addMeal, picks) : []}
                  onPickDay={(day) => {
                    onAdd(r, day, addMeal);
                    setPreferredMeal(addMeal);
                    setAddingId(null);
                    requestAnimationFrame(() => document.getElementById(`addbtn-${r.id}`)?.focus({ preventScroll: true }));
                  }}
                />
              ))}
            </ol>
          ) : searching ? (
            <div className="empty">
              <p>
                没找到和“{query.trim()}”相关的{category === 'all' ? '餐厅' : categoryOf(category).name}
                {price !== 'all' && `（${price}）`}。
              </p>
              <p className="small">换个说法试试，比如“烤鸭”“pizza”“Surry Hills”。</p>
              <div className="empty__actions">
                {category !== 'all' && inAllCategories > 0 && (
                  <button type="button" className="btn btn--outline" onClick={() => pickCategory('all', true)}>
                    看全部类别的 {inAllCategories} 家
                  </button>
                )}
                {price !== 'all' && atAnyPrice > 0 && (
                  <button type="button" className="btn btn--outline" onClick={showAllPrices}>
                    查看全部价位
                  </button>
                )}
                <button type="button" className="btn btn--outline" onClick={clearSearch}>
                  清除搜索
                </button>
              </div>
            </div>
          ) : (
            <div className="empty">
              <p>这个价位暂时没有{category === 'all' ? '' : categoryOf(category).name}。</p>
              <button type="button" className="btn btn--outline" onClick={showAllPrices}>
                查看全部价位
              </button>
            </div>
          )}
          {list.length > COLLAPSED_ROWS && (
            <button
              type="button"
              className="btn btn--outline btn--round expand"
              aria-expanded={expanded}
              aria-controls={ROWS_ID}
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
  /** In a list mixing categories, say which one it ranks in instead of showing a bare number. */
  showCategory: boolean;
  placements: string[];
  adding: boolean;
  onToggleAdd: () => void;
  addMeal: Meal;
  onAddMeal: (m: Meal) => void;
  freeDays: number[];
  onPickDay: (day: number) => void;
}

function RestaurantRow({ restaurant: r, showCategory, placements, adding, onToggleAdd, addMeal, onAddMeal, freeDays, onPickDay }: RowProps) {
  const popId = `add-${r.id}`;
  return (
    <li className="row">
      <div className="row__main">
        {!showCategory && <span className={`rank rank--big${r.rank === 1 ? ' rank--first' : ''}`}>{rankLabel(r.rank)}</span>}
        <div className="row__body">
          {showCategory && (
            <span className={`row__cat${r.rank === 1 ? ' row__cat--first' : ''}`}>
              {categoryOf(r.category).name} · 第 {r.rank} 名
            </span>
          )}
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
