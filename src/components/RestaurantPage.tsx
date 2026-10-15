import { useEffect, useRef, useState } from 'react';
import { loadDetails, type DetailFile, type Dish, type Photo } from '../data/details';
import { RESTAURANT_BY_ID, categoryOf, mapsUrl } from '../data/restaurants';
import type { Meal, Restaurant, ServiceMeal } from '../data/types';
import { closedLabel, freeSydneyDays, placementsOf, servesMeal, type Picks } from '../lib/plan';
import { hostOf } from '../lib/url';
import { AddPopover } from './AddPopover';
import { BackIcon, PlusIcon } from './Icons';
import { ReviewsSection, TaChip, XhsChip } from './Reviews';

const SERVICE_LABEL: Record<ServiceMeal, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };

/** Dinner, unless it serves lunch but not dinner. */
function defaultMeal(r: Restaurant): Meal {
  return !servesMeal(r, 'dinner') && servesMeal(r, 'lunch') ? 'lunch' : 'dinner';
}

/** A photo from the restaurant's site; the owner drops it (and its credit) if the site stops serving it. */
function SitePhoto({ src, alt, className, onFail }: { src: string; alt: string; className: string; onFail: () => void }) {
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onFail} />;
}

function DishCard({ dish }: { dish: Dish }) {
  const label = dish.nameZh || dish.name;
  const [failed, setFailed] = useState(false);
  const image = failed ? null : dish.image;
  return (
    <li className="dish">
      {image && <SitePhoto className="dish__img" src={image} alt={label} onFail={() => setFailed(true)} />}
      <div className="dish__body">
        <h3 className="dish__name">{label}</h3>
        {dish.nameZh && dish.name !== dish.nameZh && <span className="dish__orig">{dish.name}</span>}
        <p className="dish__desc">{dish.desc}</p>
        {image && dish.imageFrom && (
          <a className="credit" href={dish.imageFrom} target="_blank" rel="noreferrer">
            图片：{hostOf(dish.imageFrom)}
          </a>
        )}
      </div>
    </li>
  );
}

/** The photos that still load; gone altogether once none do. */
function Gallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = photos.filter((p) => !failed.has(p.image));
  if (!shown.length) return null;
  return (
    <div className="gallery">
      {shown.map((p) => (
        <figure key={p.image} className="gallery__item">
          <SitePhoto className="gallery__img" src={p.image} alt={p.caption || name} onFail={() => setFailed((s) => new Set(s).add(p.image))} />
          <figcaption>
            {p.caption && <span>{p.caption}</span>}
            <a className="credit" href={p.imageFrom} target="_blank" rel="noreferrer">
              图片：{hostOf(p.imageFrom)}
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** "营业时间：…" with where it was read; just the closing days when that is all that was checked. */
function OpeningHours({ restaurant: r }: { restaurant: Restaurant }) {
  const text = r.hours || closedLabel(r);
  if (!text) return null;
  return (
    <p className="detail__hours">
      营业时间：{text}
      {r.hoursSource && (
        <a className="credit" href={r.hoursSource} target="_blank" rel="noreferrer">
          来源：{hostOf(r.hoursSource)}
        </a>
      )}
    </p>
  );
}

interface PageProps {
  id: string;
  picks: Picks;
  onAdd: (restaurant: Restaurant, day: number, meal: Meal) => void;
  onClose: () => void;
}

/** One restaurant's own page: what to order, how the menu works, and putting it on the calendar. */
export function RestaurantPage({ id, picks, onAdd, onClose }: PageProps) {
  const r = RESTAURANT_BY_ID.get(id)!;
  const [file, setFile] = useState<DetailFile | null>(null);
  const [load, setLoad] = useState<'loading' | 'failed' | 'done'>('loading');
  /** Bumped by the retry button to load the menus again. */
  const [tries, setTries] = useState(0);
  const detail = file?.details[id];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuHeadingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState<Meal>(() => defaultMeal(r));
  const placements = placementsOf(id, picks);
  const popId = `detail-add-${id}`;

  useEffect(() => {
    let live = true;
    loadDetails().then(
      (f) => {
        if (!live) return;
        // The retry button goes away with the menu's arrival; don't let focus go with it.
        if (retryRef.current && document.activeElement === retryRef.current) menuHeadingRef.current?.focus({ preventScroll: true });
        setFile(f);
        setLoad('done');
      },
      () => live && setLoad('failed'),
    );
    return () => {
      live = false;
    };
  }, [tries]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const title = document.title;
    document.title = `${r.name} · 悉尼吃什么`;
    return () => {
      document.title = title;
    };
  }, [r.name]);

  const retrying = load === 'loading' && tries > 0;
  const retry = () => {
    if (retrying) return;
    setLoad('loading');
    setTries((t) => t + 1);
  };

  return (
    <main className="page detail" aria-labelledby="detail-h">
      <button type="button" className="btn btn--ghost detail__back" onClick={onClose}>
        <BackIcon />
        <span>返回</span>
      </button>

      <header className="detail__head">
        <span className="eyebrow">
          {categoryOf(r.category).name} · 第 {r.rank} 名
        </span>
        <h1 id="detail-h" ref={headingRef} tabIndex={-1}>
          {r.name}
        </h1>
        <span className="detail__meta">
          {r.nameZh && `${r.nameZh} · `}
          {r.suburb} · {r.price} · 营业：{r.meals.map((m) => SERVICE_LABEL[m]).join('、')}
        </span>
        <OpeningHours restaurant={r} />
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
        <p className="detail__intro">{r.intro}</p>
      </header>

      {detail && detail.photos.length > 0 && <Gallery photos={detail.photos} name={r.name} />}

      <div className="detail__body">
        <div className="detail__main">
          <section aria-labelledby="detail-menu-h" className="detail__section">
            <h2 id="detail-menu-h" ref={menuHeadingRef} tabIndex={-1}>
              菜单
            </h2>
            {detail ? (
              <>
                <p className="detail__text">{detail.menu}</p>
                {detail.note && <p className="detail__note">{detail.note}</p>}
                {detail.menuUrl && (
                  <a className="detail__menu-link" href={detail.menuUrl} target="_blank" rel="noreferrer">
                    看完整菜单（{hostOf(detail.menuUrl)}）
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="detail__text muted" role="status">
                  {load === 'done' ? '这家的菜单还在整理，先看官网吧。' : load === 'failed' ? '菜单没加载出来，检查一下网络再试一次。' : '正在加载菜单…'}
                </p>
                {(load === 'failed' || retrying) && (
                  <button type="button" ref={retryRef} className="btn btn--ghost detail__retry" aria-disabled={retrying} onClick={retry}>
                    {retrying ? '加载中…' : '重试'}
                  </button>
                )}
              </>
            )}
          </section>

          {detail && detail.dishes.length > 0 && (
            <section aria-labelledby="detail-dishes-h" className="detail__section">
              <h2 id="detail-dishes-h">招牌菜</h2>
              <ul className="dishes">
                {detail.dishes.map((d) => (
                  <DishCard key={d.name} dish={d} />
                ))}
              </ul>
            </section>
          )}

          <ReviewsSection restaurant={r} />
        </div>

        <aside className="detail__side" aria-label="订位与安排">
          <div className="detail__card">
            <span className="detail__card-title">订位</span>
            <p>{r.booking}</p>
            {placements.length > 0 && <span className="placed">已在日历：{placements.join('、')}</span>}
            <button
              type="button"
              id={`detail-addbtn-${id}`}
              ref={addRef}
              className="btn btn--primary"
              aria-expanded={adding}
              aria-controls={popId}
              onClick={() => setAdding(!adding)}
            >
              <PlusIcon />
              <span>加入日历</span>
            </button>
            {adding && (
              <AddPopover
                id={popId}
                restaurant={r}
                meal={meal}
                onMeal={setMeal}
                freeDays={freeSydneyDays(meal, picks)}
                onPickDay={(day) => {
                  onAdd(r, day, meal);
                  setAdding(false);
                  // The day button that was pressed is about to go with the popover.
                  addRef.current?.focus({ preventScroll: true });
                }}
              />
            )}
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
          </div>

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

          {detail && detail.sources.length > 0 && (
            <details className="sources">
              <summary>菜单资料来源（{detail.sources.length}）</summary>
              <ul className="sources__links">
                {detail.sources.map((s) => (
                  <li key={s}>
                    <a href={s} target="_blank" rel="noreferrer">
                      {hostOf(s)}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>

      {file && detail && (
        <p className="detail__fine">菜单、价格和招牌菜整理于 {file.checkedOn}，会随季节变动，以餐厅官网为准。图片来自餐厅官网，点图片下的链接可以看原页面。</p>
      )}
    </main>
  );
}
