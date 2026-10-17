import { useRef, useState } from 'react';
import { CATEGORIES, RESTAURANT_BY_ID, categoryOf, restaurantsIn, searchRestaurants } from '../data/restaurants';
import type { CategoryId, Meal, Price, Restaurant } from '../data/types';
import { useGridColumns } from '../hooks/useGridColumns';
import { freeSydneyDays, placementsOf, type Picks } from '../lib/plan';
import { detailHref } from '../lib/route';
import { AddPopover } from './AddPopover';
import { CloseIcon, HeartIcon, PlusIcon, SearchIcon } from './Icons';
import { TaChip, XhsChip } from './Reviews';
import { Segmented } from './Segmented';
import { Sources } from './Sources';

/** What the board shows: the overview, the saved list, or one category. */
export type BoardCategory = 'all' | 'wish' | CategoryId;
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
  wishlist: string[];
  onToggleWish: (id: string) => void;
  onAdd: (restaurant: Restaurant, day: number, meal: Meal) => void;
}

export function RestaurantBoard({ category, onCategory, picks, wishlist, onToggleWish, onAdd }: BoardProps) {
  const [price, setPrice] = useState<PriceFilter>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addMeal, setAddMeal] = useState<Meal>('dinner');
  const [allBlocks, setAllBlocks] = useState(false);
  const [blocksEl, setBlocksEl] = useState<HTMLDivElement | null>(null);
  const columns = useGridColumns(blocksEl, 3);
  const collapsedBlocks = Math.max(columns, MIN_COLLAPSED_BLOCKS);
  const sectionRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const priceOk = (r: Restaurant) => price === 'all' || r.price === price;
  const countIn = (id: CategoryId) => restaurantsIn(id).filter(priceOk).length;
  const total = CATEGORIES.reduce((n, c) => n + countIn(c.id), 0);
  const wished = wishlist.map((id) => RESTAURANT_BY_ID.get(id)).filter((r): r is Restaurant => !!r);
  const searching = query.trim().length > 0;

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
    setQuery('');
    setExpanded(false);
    setAddingId(null);
    settle(fromBlock ? '.tabs [aria-pressed="true"]' : undefined);
  };

  let list: Restaurant[] = [];
  let heading = '';
  let mixed = false;
  if (searching) {
    list = searchRestaurants(query).filter(priceOk);
    heading = `搜索“${query.trim()}”`;
    mixed = true;
  } else if (category === 'wish') {
    list = wished.filter(priceOk);
    heading = '想去的店';
    mixed = true;
  } else if (category !== 'all') {
    list = restaurantsIn(category).filter(priceOk);
    heading = `${categoryOf(category).name}排名`;
  }
  const visible = expanded ? list : list.slice(0, COLLAPSED_ROWS);

  const toggleWish = (id: string) => {
    // Un-saving in the 想去 view removes the row with the focused button; hand focus to a neighbour.
    if (!searching && category === 'wish' && wishlist.includes(id)) {
      const i = visible.findIndex((r) => r.id === id);
      const next = visible[i + 1] ?? visible[i - 1];
      requestAnimationFrame(() => {
        const target = next ? document.getElementById(`wish-${next.id}`) : sectionRef.current?.querySelector<HTMLElement>('.tab--wish');
        target?.focus({ preventScroll: true });
      });
    }
    onToggleWish(id);
  };
  const listHeadingId = 'list-cat-h';
  const showOverview = !searching && category === 'all';

  const emptyText = searching
    ? `没找到“${query.trim()}”${price !== 'all' ? `（${price}）` : ''}，换个关键词试试，比如“烤鸭”“pizza”“Surry Hills”。`
    : category === 'wish'
      ? wished.length
        ? `想去的店里暂时没有 ${price} 的。`
        : '还没有想去的店。在榜单里点「想去」收藏，挑日子时它们会排在最前面。'
      : category !== 'all'
        ? `这个价位暂时没有${categoryOf(category).name}。`
        : '';

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

      <div className="search" role="search">
        <label htmlFor="board-q" className="sr-only">
          搜索榜单
        </label>
        <SearchIcon />
        <input
          ref={searchRef}
          id="board-q"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(false);
            setAddingId(null);
          }}
          placeholder="搜店名、菜系或区域，比如：烤鸭、pizza、Surry Hills"
          autoComplete="off"
        />
        {searching && (
          <button
            type="button"
            className="search__clear"
            aria-label="清除搜索"
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      <div role="group" aria-label="按类别查看" className="tabs">
        <button type="button" className="tab" aria-pressed={!searching && category === 'all'} onClick={() => pickCategory('all')}>
          <span>全部</span>
          <span className="tab__count">{total}</span>
        </button>
        <button type="button" className="tab tab--wish" aria-pressed={!searching && category === 'wish'} onClick={() => pickCategory('wish')}>
          <HeartIcon size={14} filled={wished.length > 0} />
          <span>想去</span>
          <span className="tab__count">{wished.filter(priceOk).length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className="tab" aria-pressed={!searching && category === c.id} onClick={() => pickCategory(c.id)}>
            <span>{c.name}</span>
            <span className="tab__count">{countIn(c.id)}</span>
          </button>
        ))}
      </div>

      {showOverview ? (
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
                            {wishlist.includes(r.id) && (
                              <span className="block__wish">
                                <HeartIcon size={13} filled />
                                <span className="sr-only">（想去）</span>
                              </span>
                            )}
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
          <h2 id={listHeadingId} className="list-heading">
            {heading}
            <span className="muted">
              {' '}
              · {list.length} 家{price !== 'all' ? ` · ${price}` : ''}
            </span>
          </h2>
          {visible.length ? (
            <ol className="rows" aria-labelledby={listHeadingId}>
              {visible.map((r) => (
                <RestaurantRow
                  key={r.id}
                  restaurant={r}
                  mixed={mixed}
                  wished={wishlist.includes(r.id)}
                  onToggleWish={() => toggleWish(r.id)}
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
              <p>{emptyText}</p>
              {price !== 'all' && (category !== 'wish' || wished.length > 0 || searching) && (
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
              )}
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
  /** The list mixes categories (search, saved), so say which category each row is from. */
  mixed: boolean;
  wished: boolean;
  onToggleWish: () => void;
  placements: string[];
  adding: boolean;
  onToggleAdd: () => void;
  addMeal: Meal;
  onAddMeal: (m: Meal) => void;
  freeDays: number[];
  onPickDay: (day: number) => void;
}

function RestaurantRow(props: RowProps) {
  const { restaurant: r, mixed, wished, onToggleWish, placements, adding, onToggleAdd, addMeal, onAddMeal, freeDays, onPickDay } = props;
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
            {mixed && <span className="chip-cat chip-cat--plain">{`${categoryOf(r.category).short}第 ${r.rank} 名`}</span>}
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
          <Sources sources={r.sources} accolades={r.accolades} />
        </div>
        <div className="row__action">
          <button
            id={`wish-${r.id}`}
            type="button"
            className="btn btn--wish"
            aria-pressed={wished}
            aria-label={`想去：${r.name}`}
            onClick={onToggleWish}
          >
            <HeartIcon filled={wished} />
            <span>想去</span>
          </button>
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
