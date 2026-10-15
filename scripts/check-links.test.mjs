import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUrl, collectLinks, formatReport, main, mapLimit, summarize } from './check-links.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check-links.mjs');
const DATA = path.join(HERE, '../src/data');

/** An address nothing listens on. */
async function deadHost() {
  const closed = http.createServer();
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
  const { port } = closed.address();
  await new Promise((resolve) => closed.close(resolve));
  return `http://127.0.0.1:${port}`;
}

const restaurant = (id, extra = {}) => ({
  id,
  name: id,
  website: '',
  sources: [],
  ta: { url: null, rating: null, reviews: null, rank: null, summary: '', praise: [], complaints: [] },
  ...extra,
});

describe('collecting links', () => {
  it('finds every URL with what it is and where it sits', () => {
    const links = collectLinks(
      {
        restaurants: [
          restaurant('a', {
            website: 'https://a.example/',
            sources: ['https://press.example/a', 'not a link'],
            hoursSource: 'https://a.example/hours',
            ta: { url: 'https://www.tripadvisor.com.au/a', rating: 4.5 },
          }),
          restaurant('b'),
        ],
      },
      {
        details: {
          a: {
            menuUrl: 'https://a.example/menu',
            dishes: [
              { name: 'x', image: null, imageFrom: null },
              { name: 'y', image: 'https://cdn.example/y.jpg', imageFrom: 'https://a.example/' },
            ],
            photos: [{ image: 'https://cdn.example/room.jpg', imageFrom: 'https://a.example/about', caption: '' }],
            sources: ['https://a.example/menu'],
          },
          b: { menuUrl: null, dishes: [], photos: [], sources: [] },
        },
      },
    );
    expect(links.map((l) => `${l.id} ${l.kind} ${l.field} ${l.url}`)).toEqual([
      'a website website https://a.example/',
      'a source sources[0] https://press.example/a',
      'a review ta.url https://www.tripadvisor.com.au/a',
      'a source hoursSource https://a.example/hours',
      'a menu detail.menuUrl https://a.example/menu',
      'a image detail.dishes[1].image https://cdn.example/y.jpg',
      'a source detail.dishes[1].imageFrom https://a.example/',
      'a image detail.photos[0].image https://cdn.example/room.jpg',
      'a source detail.photos[0].imageFrom https://a.example/about',
      'a source detail.sources[0] https://a.example/menu',
    ]);
  });

  it('covers every photo and menu link in the real data', async () => {
    const restaurants = JSON.parse(await readFile(path.join(DATA, 'restaurants.json'), 'utf8'));
    const { details } = JSON.parse(await readFile(path.join(DATA, 'details.json'), 'utf8'));
    const links = collectLinks(restaurants, { details });
    const all = Object.values(details);
    const images = all.flatMap((d) => [...d.dishes.map((x) => x.image), ...d.photos.map((p) => p.image)]).filter(Boolean);
    const menus = all.map((d) => d.menuUrl).filter(Boolean);
    expect(links.filter((l) => l.kind === 'image').map((l) => l.url)).toEqual(images);
    expect(links.filter((l) => l.kind === 'menu').map((l) => l.url)).toEqual(menus);
    expect(links.filter((l) => l.field === 'website')).toHaveLength(restaurants.restaurants.filter((r) => r.website).length);
    for (const l of links) expect(() => new URL(l.url), `${l.id} ${l.field}`).not.toThrow();
  });
});

describe('checking links', () => {
  /** @type {http.Server} */
  let server;
  let base = '';
  /** @type {string[]} */
  const seen = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      const send = (status, type = 'text/html', headers = {}) => {
        res.writeHead(status, { 'content-type': type, ...headers });
        res.end(req.method === 'GET' ? 'body' : undefined);
      };
      switch (req.url) {
        case '/ok':
          return send(200);
        case '/photo.jpg':
          return send(200, 'image/jpeg');
        case '/moved.jpg':
          return send(301, 'text/html', { location: '/photo.jpg' });
        case '/no-head':
          return send(req.method === 'HEAD' ? 405 : 200);
        case '/hotlink.jpg':
          return send(req.method === 'HEAD' ? 403 : 200, 'image/jpeg');
        case '/walled':
          return send(403);
        case '/busy':
          return send(429);
        case '/slow':
          return; // never answers
        default:
          return send(404);
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it('tells working links from broken ones', async () => {
    expect(await checkUrl(`${base}/ok`)).toEqual({ state: 'ok', note: 'HTTP 200' });
    expect(await checkUrl(`${base}/gone`)).toEqual({ state: 'broken', note: 'HTTP 404' });
    expect(await checkUrl(`${base}/moved.jpg`, { image: true })).toEqual({ state: 'ok', note: 'HTTP 200' });
    expect(await checkUrl(`${base}/busy`)).toMatchObject({ state: 'unsure' });
  });

  it('asks again with GET when HEAD is refused', async () => {
    seen.length = 0;
    expect(await checkUrl(`${base}/no-head`)).toMatchObject({ state: 'ok' });
    expect(await checkUrl(`${base}/hotlink.jpg`, { image: true })).toMatchObject({ state: 'ok' });
    expect(seen).toEqual(['HEAD /no-head', 'GET /no-head', 'HEAD /hotlink.jpg', 'GET /hotlink.jpg']);
  });

  it('is stricter with photos than with pages', async () => {
    // A page behind a bot wall usually opens fine in a browser; a photo that says 403 does not.
    expect(await checkUrl(`${base}/walled`)).toMatchObject({ state: 'unsure' });
    expect(await checkUrl(`${base}/walled`, { image: true })).toMatchObject({ state: 'broken', note: 'HTTP 403' });
    // A photo URL that now answers with a web page is gone.
    expect(await checkUrl(`${base}/ok`, { image: true })).toEqual({ state: 'broken', note: '不是图片（text/html）' });
  });

  it('gives up on slow and unreachable servers', async () => {
    expect(await checkUrl(`${base}/slow`, { timeout: 200 })).toEqual({ state: 'broken', note: '超时（0.2 秒）', network: true });
    expect(await checkUrl(`${await deadHost()}/`)).toEqual({ state: 'broken', note: '连不上（ECONNREFUSED）', network: true });
  });

  describe('a full run', () => {
    let dir = '';
    beforeAll(async () => {
      dir = await mkdtemp(path.join(os.tmpdir(), 'check-links-'));
    });
    afterAll(() => rm(dir, { recursive: true, force: true }));

    async function fixture(detail, host = base) {
      const restaurants = path.join(dir, 'restaurants.json');
      const details = path.join(dir, 'details.json');
      await writeFile(
        restaurants,
        JSON.stringify({
          restaurants: [restaurant('a', { website: `${host}/ok`, sources: [`${host}/gone`] }), restaurant('b', { sources: [`${host}/ok`] })],
        }),
      );
      await writeFile(details, JSON.stringify({ details: { b: detail } }));
      return ['--restaurants', restaurants, '--details', details, '--timeout', '2000'];
    }

    it('fails when a photo is broken, and lists problems by restaurant', async () => {
      const args = await fixture({ menuUrl: `${base}/no-head`, dishes: [{ image: `${base}/missing.jpg`, imageFrom: `${base}/ok` }], photos: [], sources: [] });
      const lines = [];
      expect(await main(args, (l) => lines.push(l))).toBe(1);
      const out = lines.join('\n');
      expect(out).toContain('检查 6 个链接（去重后 4 个）');
      expect(out).toMatch(/\na\n {2}\[提醒\] 来源 sources\[0\]：HTTP 404\n.*\/gone/);
      expect(out).toMatch(/\nb\n {2}\[失效\] 图片 detail\.dishes\[0\]\.image：HTTP 404\n.*\/missing\.jpg/);
      expect(out).not.toContain('menuUrl');
      expect(lines.at(-1)).toBe('图片/菜单链接失效 1 个，其他问题 1 个。');
    });

    it('passes with only warnings, from the command line too', async () => {
      const args = await fixture({
        menuUrl: `${base}/ok`,
        dishes: [],
        photos: [{ image: `${base}/photo.jpg`, imageFrom: `${base}/ok`, caption: '' }],
        sources: [],
      });
      const { code, stdout } = await new Promise((resolve) => {
        execFile(process.execPath, [SCRIPT, ...args], (err, stdout) => resolve({ code: err ? err.code : 0, stdout }));
      });
      expect(code).toBe(0);
      expect(stdout).toContain('[提醒] 来源 sources[0]：HTTP 404');
      expect(stdout).toContain('图片/菜单链接失效 0 个，其他问题 1 个。');
    });

    it("doesn't list every link when the machine is offline", async () => {
      const args = await fixture({ menuUrl: null, dishes: [], photos: [], sources: [] }, await deadHost());
      const lines = [];
      expect(await main(args, (l) => lines.push(l))).toBe(2);
      expect(lines).toEqual(['检查 3 个链接（去重后 2 个）…', '一个链接都连不上，先检查一下网络再跑。']);
    });
  });
});

describe('reporting', () => {
  it('runs at most the given number of checks at once, in order', async () => {
    let running = 0;
    let most = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(most).toBe(3);
  });

  it('counts only broken photos and menus as failures', () => {
    const link = (id, kind, url) => ({ id, kind, field: kind, url });
    const links = [link('a', 'image', 'u1'), link('a', 'source', 'u2'), link('b', 'menu', 'u3'), link('b', 'image', 'u4'), link('c', 'website', 'u5')];
    const checks = new Map([
      ['u1', { state: 'broken', note: 'HTTP 404' }],
      ['u2', { state: 'broken', note: 'HTTP 404' }],
      ['u3', { state: 'unsure', note: 'HTTP 429' }],
      ['u4', { state: 'ok', note: 'HTTP 200' }],
      ['u5', { state: 'ok', note: 'HTTP 200' }],
    ]);
    const summary = summarize(links, checks);
    expect(summary.failing).toBe(1);
    expect(summary.warnings).toBe(2);
    expect([...summary.byId.keys()]).toEqual(['a', 'b']);
    expect(formatReport(summary)).toContain('  [提醒] 菜单 menu：HTTP 429');
    expect(formatReport(summarize([], new Map())).at(-1)).toBe('所有链接都正常。');
  });
});
