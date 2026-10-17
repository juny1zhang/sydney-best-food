# 悉尼吃什么 · Sydney Eats

悉尼 13 个类别里评价最高的餐厅榜单，配一个 2026 年 12 月的日历：把每天要吃的店排进去，已经订好的餐厅会把日期涂上颜色，点开能看到餐厅、类别标签和简介。

- **榜单**：中餐、火锅、烤肉、日料、韩餐、东南亚、中东 / 地中海、意大利 / 披萨、法餐 / 欧陆小馆、现代澳洲、海鲜、牛排馆、早午餐 / 甜品，共 88 家。“全部”视图默认只露出第一排类别。排名综合 2026 SMH Good Food Guide、AGFG、World’s 101 Best Steak、Gourmet Traveller、Broadsheet / Time Out 等来源，每家都附“评价依据”和来源链接，营业状态核对于 2026-10-12。顶部可以搜店名、菜系或区域（中英文都行），点 ♡ 存进“想去”，挑店时想去的排在最前面。
- **餐厅详情页**：点店名打开（地址是 `#r/<id>`，可以直接分享）。有菜单怎么点、大概花多少、招牌菜和餐厅官网上的图片，也能直接加入日历。
- **日历**：橙色 = 已订位，蓝色 = 选好了还没订位，浅绿 = 在新西兰，虚线 = 飞行日。悉尼的空日子从榜单挑，也可以“随机挑一家”；新西兰的日子有沿途推荐（见下），也可以手动记一家。
- **订位**：选好的店点“标记已订位”，写上几点和备注（比如订位号），日期就变成橙色。
- **计划总览**：按日期列出整个十二月的每一餐，标出哪些还没订位，附订位提示。“导出到手机日历”生成 `.ics` 文件，iPhone / 安卓 / 电脑日历都能导入；悉尼（AEDT）和新西兰（NZDT）的时区已经换算好，没订位的会标“（未订位）”。
- **新西兰沿途推荐**：按行程每天午餐、晚餐大概在哪个小镇吃，从奥克兰、罗托鲁瓦到特卡波、皇后镇、奥马鲁、基督城共 18 个小镇 57 家，包括 2026 米其林新西兰指南星级 / 必比登、Cuisine 2026 等来源，每家都有简介、订位提示和来源链接。行程里已经订好的 Advieh 和 Kika 不重复列出。营业时间各来源常有出入，出发前请再确认。
- **共享**：配好 Supabase 后，所有打开网站的人编辑的是同一份日历，改动实时同步（顶部会显示“实时同步”），订位时间和备注也一起同步；“分享给家人”按钮可以直接把网址发出去。网站没有登录，拿到链接的人都能改。浏览器里的 localStorage 只是缓存，让页面秒开；没配 Supabase 时（比如跑测试），选择只存在本机。“想去”清单只存在各自的设备上。
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
| `src/data/restaurants.json` | 悉尼餐厅榜单：类别、排名、简介、标签、订位提示、营业餐段、获奖原文与来源链接 |
| `src/data/details.json` | 详情页：菜单概况、官网菜单链接、招牌菜（中英文名、简介、图片）、餐厅照片、资料来源。图片只用餐厅或所属集团官网上的 |
| `src/data/nz.json` | 新西兰沿途推荐：所在小镇、类别、价位、简介、订位提示、营业餐段、地址与来源链接 |
| `src/data/nz.ts` | 新西兰小镇列表，以及每天午餐 / 晚餐优先推荐哪些小镇（`DAY_TOWNS`） |
| `src/data/december.ts` | 12 月每天在哪、当天行程、节日，以及新西兰行程里已订的两家餐厅 |

改榜单直接编辑 `restaurants.json`，`rank` 决定类别内的顺序；`src/data/restaurants.test.ts` 会检查 id 唯一、排名连续、每家都有来源。新西兰的店 id 以 `nz-` 开头，`src/data/nz.test.ts` 会检查每天的午餐和晚餐都有可选的店、每家都有来源。
