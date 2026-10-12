# 悉尼吃什么 · Sydney Eats

悉尼 11 个类别里评价最高的餐厅榜单，配一个 2026 年 12 月的日历：把每天要吃的店排进去，已经订好的餐厅会把日期涂上颜色，点开能看到餐厅、类别标签和简介。

- **榜单**：中餐、日料、韩餐、东南亚、中东 / 地中海、意大利 / 披萨、法餐 / 欧陆小馆、现代澳洲、海鲜、牛排 / 烧烤、早午餐 / 甜品，共 82 家。“全部”视图默认只露出第一排类别。排名综合 2026 SMH Good Food Guide、AGFG、World’s 101 Best Steak、Gourmet Traveller、Broadsheet / Time Out 等来源，每家都附“评价依据”和来源链接，营业状态核对于 2026-10-12。
- **餐厅详情页**：点店名打开（地址是 `#r/<id>`，可以直接分享）。有菜单怎么点、大概花多少、招牌菜和餐厅官网上的图片，也能直接加入日历。
- **日历**：橙色 = 已预订，蓝色 = 自己选好的，浅绿 = 在新西兰，虚线 = 飞行日。悉尼的空日子可以从榜单搜索、挑选；新西兰的日子可以手动记一家当地的店。
- **共享**：配好 Supabase 后，所有打开网站的人编辑的是同一份日历，改动实时同步（顶部会显示“实时同步”）。网站没有登录，拿到链接的人都能改。浏览器里的 localStorage 只是缓存，让页面秒开；没配 Supabase 时（比如跑测试），选择只存在本机。
- **意见反馈**：页面底部的表单，写进 Supabase 的 `feedback` 表。访客只能提交、不能查看；在 Supabase 控制台 Table Editor → `feedback` 里看。

## 开发

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm test           # Vitest 单元测试 + 组件测试
npm run typecheck
npm run build      # 输出到 dist/
```

技术栈：Vite + React 18 + TypeScript，纯静态站点。

## 共享日历（Supabase）

建表 SQL 在 `supabase/migrations/`：`picks` 表每顿饭一行，只接受 `dec-2026` 这一份计划，最多 62 行；`feedback` 表只开放写入。连接信息写在 `.env`（`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`）：publishable key 本来就是给浏览器用的，可以提交。`.env.test` 把它们清空，所以测试不会碰到真实数据。

## 部署到 Vercel

`vercel.json` 已经写好构建设置（`npm ci` → `npm run build` → 输出 `dist/`）。在 Vercel 控制台 **Add New → Project → Import Git Repository**，选 `juny1zhang/sydney-best-food` 直接 Deploy 即可；之后每次 push 都会自动重新部署。

## 数据

| 文件 | 内容 |
| --- | --- |
| `src/data/restaurants.json` | 餐厅榜单：类别、排名、简介、标签、订位提示、营业餐段、获奖原文与来源链接 |
| `src/data/details.json` | 详情页：菜单概况、官网菜单链接、招牌菜（中英文名、简介、图片）、餐厅照片、资料来源。图片只用餐厅或所属集团官网上的 |
| `src/data/december.ts` | 12 月每天在哪、当天行程、节日，以及新西兰行程里已订的两家餐厅 |

改榜单直接编辑 `restaurants.json`，`rank` 决定类别内的顺序；`src/data/restaurants.test.ts` 会检查 id 唯一、排名连续、每家都有来源。
