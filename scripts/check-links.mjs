#!/usr/bin/env node
// @ts-check
/**
 * Checks every link in the restaurant data and lists the ones that stopped working, by restaurant.
 * Photos are hotlinked from the restaurants' own sites and rot quietly, so a broken photo or menu
 * link fails the run; other links (sources, websites, review pages, where the hours came from) are
 * only reported.
 *
 *   npm run check:links
 *   npm run check:links -- --timeout 20000 --concurrency 4
 */
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @typedef {'image' | 'menu' | 'website' | 'review' | 'source'} LinkKind */
/** @typedef {{ id: string, kind: LinkKind, field: string, url: string }} Link */
/** @typedef {{ state: 'ok' | 'broken' | 'unsure', note: string, network?: boolean }} Check */
/** @typedef {{ link: Link, check: Check }} Problem */

/** Broken links of these kinds show on the site: a gap where a photo was, a menu link to nowhere. */
export const BLOCKING = new Set(['image', 'menu']);

/** @type {Record<LinkKind, string>} */
export const KIND_LABEL = { image: '图片', menu: '菜单', website: '官网', review: '点评', source: '来源' };

/** Servers that refuse HEAD often answer GET fine. */
const RETRY_WITH_GET = new Set([403, 405, 501]);

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * @param {(string | number)[]} keys
 * @returns {LinkKind}
 */
function kindOf(keys) {
  const last = [...keys].reverse().find((k) => typeof k === 'string');
  if (last === 'image') return 'image';
  if (last === 'menuUrl') return 'menu';
  if (keys[0] === 'ta' || keys[0] === 'xhs') return 'review';
  if (last === 'website') return 'website';
  return 'source';
}

/** @param {(string | number)[]} keys e.g. ["dishes", 2, "image"] → "dishes[2].image" */
function fieldOf(keys) {
  return keys.map((k, i) => (typeof k === 'number' ? `[${k}]` : i ? `.${k}` : k)).join('');
}

/**
 * Every string in `value` that is an http(s) URL, with the keys that lead to it.
 * @param {unknown} value
 * @param {(string | number)[]} keys
 * @returns {Generator<{ keys: (string | number)[], url: string }>}
 */
function* urlsIn(value, keys = []) {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value.trim())) yield { keys, url: value.trim() };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* urlsIn(value[i], [...keys, i]);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* urlsIn(v, [...keys, k]);
  }
}

/**
 * Every URL in restaurants.json and details.json, in list order. Fields from details.json are
 * prefixed "detail." so the two files' sources can be told apart.
 * @param {{ restaurants: { id: string }[] }} restaurantFile
 * @param {{ details: Record<string, unknown> }} detailFile
 * @returns {Link[]}
 */
export function collectLinks(restaurantFile, detailFile) {
  /** @type {Link[]} */
  const links = [];
  const byId = new Map(restaurantFile.restaurants.map((r) => [r.id, r]));
  for (const id of new Set([...byId.keys(), ...Object.keys(detailFile.details)])) {
    for (const { keys, url } of urlsIn(byId.get(id))) links.push({ id, kind: kindOf(keys), field: fieldOf(keys), url });
    for (const { keys, url } of urlsIn(detailFile.details[id])) {
      links.push({ id, kind: kindOf(keys), field: `detail.${fieldOf(keys)}`, url });
    }
  }
  return links;
}

/**
 * @param {string} url
 * @param {'HEAD' | 'GET'} method
 * @param {boolean} image
 * @param {number} timeout ms
 */
async function request(url, method, image, timeout) {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
    headers: {
      'user-agent': BROWSER_UA,
      accept: image ? 'image/avif,image/webp,image/*,*/*;q=0.8' : 'text/html,application/xhtml+xml,*/*;q=0.8',
    },
  });
  // Only the status and headers matter; don't download the page.
  await res.body?.cancel().catch(() => {});
  return res;
}

/**
 * HEAD first, GET when the server won't answer HEAD. Redirects are followed. An image URL that
 * answers with a web page counts as broken (that is what a moved photo usually turns into).
 * @param {string} url
 * @param {{ image?: boolean, timeout?: number }} [options]
 * @returns {Promise<Check>}
 */
export async function checkUrl(url, { image = false, timeout = 15000 } = {}) {
  let res;
  try {
    res = await request(url, 'HEAD', image, timeout);
    if (RETRY_WITH_GET.has(res.status)) res = await request(url, 'GET', image, timeout);
  } catch (e) {
    const err = /** @type {Error & { cause?: { code?: string, message?: string } }} */ (e);
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return { state: 'broken', note: `超时（${timeout / 1000} 秒）`, network: true };
    return { state: 'broken', note: `连不上（${err.cause?.code ?? err.cause?.message ?? err.message}）`, network: true };
  }
  const { status } = res;
  if (status === 429) return { state: 'unsure', note: 'HTTP 429，被限流了，过会儿再查' };
  if (status === 403 && !image) return { state: 'unsure', note: 'HTTP 403，可能是防爬，手动打开确认' };
  if (status >= 400) return { state: 'broken', note: `HTTP ${status}` };
  const type = res.headers.get('content-type') ?? '';
  if (image && /^text\/html/i.test(type)) return { state: 'broken', note: `不是图片（${type.split(';')[0]}）` };
  return { state: 'ok', note: `HTTP ${status}` };
}

/**
 * Runs `fn` over `items`, at most `limit` at a time, keeping the order.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, limit, fn) {
  /** @type {R[]} */
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/**
 * Problems grouped by restaurant id (in list order); `failing` counts the broken photos and menu links.
 * @param {Link[]} links
 * @param {Map<string, Check>} checks by URL
 */
export function summarize(links, checks) {
  /** @type {Map<string, Problem[]>} */
  const byId = new Map();
  let failing = 0;
  let warnings = 0;
  for (const link of links) {
    const check = checks.get(link.url);
    if (!check || check.state === 'ok') continue;
    if (check.state === 'broken' && BLOCKING.has(link.kind)) failing++;
    else warnings++;
    byId.set(link.id, [...(byId.get(link.id) ?? []), { link, check }]);
  }
  return { byId, failing, warnings };
}

/**
 * @param {ReturnType<typeof summarize>} summary
 * @returns {string[]}
 */
export function formatReport({ byId, failing, warnings }) {
  const lines = [];
  for (const [id, problems] of byId) {
    lines.push('', id);
    for (const { link, check } of problems) {
      const tag = check.state === 'broken' && BLOCKING.has(link.kind) ? '失效' : '提醒';
      lines.push(`  [${tag}] ${KIND_LABEL[link.kind]} ${link.field}：${check.note}`, `         ${link.url}`);
    }
  }
  lines.push('', failing || warnings ? `图片/菜单链接失效 ${failing} 个，其他问题 ${warnings} 个。` : '所有链接都正常。');
  return lines;
}

/**
 * @param {string[]} argv
 * @param {(line: string) => void} log
 * @returns {Promise<number>} the exit code: 1 when a photo or menu link is broken, 2 when nothing could be reached
 */
export async function main(argv = process.argv.slice(2), log = console.log) {
  const { values } = parseArgs({
    args: argv,
    options: {
      restaurants: { type: 'string', default: path.join(ROOT, 'src/data/restaurants.json') },
      details: { type: 'string', default: path.join(ROOT, 'src/data/details.json') },
      timeout: { type: 'string', default: '15000' },
      concurrency: { type: 'string', default: '8' },
    },
  });
  const timeout = Number(values.timeout);
  const concurrency = Number(values.concurrency);
  if (!(timeout > 0) || !(concurrency >= 1)) throw new Error('--timeout and --concurrency take positive numbers');

  const [restaurantFile, detailFile] = await Promise.all([values.restaurants, values.details].map(async (f) => JSON.parse(await readFile(f, 'utf8'))));
  const links = collectLinks(restaurantFile, detailFile);
  /** @type {Map<string, boolean>} URL → whether any use of it is a photo */
  const urls = new Map();
  for (const l of links) urls.set(l.url, (urls.get(l.url) ?? false) || l.kind === 'image');
  log(`检查 ${links.length} 个链接（去重后 ${urls.size} 个）…`);

  const checked = await mapLimit([...urls], concurrency, async ([url, image]) => /** @type {const} */ ([url, await checkUrl(url, { image, timeout })]));
  if (checked.length && checked.every(([, c]) => c.network)) {
    log('一个链接都连不上，先检查一下网络再跑。');
    return 2;
  }
  const summary = summarize(links, new Map(checked));
  for (const line of formatReport(summary)) log(line);
  return summary.failing ? 1 : 0;
}

// Node reports this module by its real path, so compare real paths: run through a symlink, it still has to run.
if (process.argv[1] && realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 2;
    },
  );
}
