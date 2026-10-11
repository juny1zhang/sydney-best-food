# 悉尼吃什么 · Sydney Eats

悉尼 12 个类别里评价最高的餐厅榜单，配一个 2026 年 12 月的日历：把每天要吃的店排进去，已经订好的餐厅会把日期涂上颜色，点开能看到餐厅、类别标签和简介。

- **榜单**：中餐、日料、韩餐、东南亚、印度 / 斯里兰卡、中东 / 地中海、意大利 / 披萨、法餐 / 欧陆小馆、现代澳洲、海鲜、牛排 / 烧烤、早午餐 / 甜品，共 88 家。排名综合 2026 SMH Good Food Guide、AGFG、World’s 101 Best Steak、Gourmet Traveller、Broadsheet / Time Out 等来源，每家都附“评价依据”和来源链接，营业状态核对于 2026-10-11。
- **日历**：橙色 = 已预订，蓝色 = 自己选好的，浅绿 = 在新西兰，虚线 = 飞行日。悉尼的空日子可以从榜单搜索、挑选；新西兰的日子可以手动记一家当地的店。
- **保存**：选好的店存在浏览器的 localStorage 里，只在这台设备上。

## 开发

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm test           # Vitest 单元测试 + 组件测试
npm run typecheck
npm run build      # 输出到 dist/
```

技术栈：Vite + React 18 + TypeScript，纯静态站点，可直接部署到 Vercel / Netlify / GitHub Pages。

## 数据

| 文件 | 内容 |
| --- | --- |
| `src/data/restaurants.json` | 餐厅榜单：类别、排名、简介、标签、订位提示、营业餐段、获奖原文与来源链接 |
| `src/data/december.ts` | 12 月每天在哪、当天行程、节日，以及新西兰行程里已订的两家餐厅 |

改榜单直接编辑 `restaurants.json`，`rank` 决定类别内的顺序；`src/data/restaurants.test.ts` 会检查 id 唯一、排名连续、每家都有来源。
