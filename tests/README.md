# tests/ —— 开发期测试与校验工具

> 本目录是 **TampermonkeyScripts** 的开发期测试区，**不属于生产脚本**（生产脚本只在 `src/*.user.js`）。
> 目标：让「给脚本加一条回归测试」成为**零配置、零依赖**的动作 —— 在对应脚本的子目录里新增一个 `.js` 文件即可，无需改运行器、无需 `npm install`。

## 目录结构（按被测脚本分目录）

```
tests/
├── run-all.js                 # 零依赖运行器, **递归**发现 tests/** 下的用例
├── lib/                       # 共享基建(不是测试)
│   └── sim/                   #   本地仿真站: 真浏览器 + 假站点(见下文)
├── fixtures/                  # 测试数据(真实页面 HTML 样本等)
└── ptautocheckin/             # PTAutoCheckIn 的用例
    ├── check-ptac-budget.js
    └── sim-security-s*.js
```

**为什么要分子目录**：本仓库是多脚本集合（`PTAutoCheckIn` / `BTSchoolHelper` /
`BilibiliEnterFullscreen` / `EnhanceVisitedLinks`）。用例都堆在 `tests/` 顶层时，
新增脚本的测试会和既有测试混在一起、命名要靠前缀区分。现在**一个脚本一个目录**
（`tests/ptautocheckin/`，将来 `tests/btschoolhelper/` …），运行器递归发现，
**新增目录不用改运行器**。

## 运行

```bash
node tests/run-all.js                                # 跑全部测试(只对失败项打印输出)
node tests/run-all.js -v                             # 总是打印子进程输出
node tests/run-all.js --list                         # 只列出发现的测试
node tests/ptautocheckin/check-ptac-budget.js        # 单独跑某一个(所有测试都能独立运行)
```

退出码：`0` 全通过 / `1` 有失败 / `2` 没发现测试或源文件缺失。可直接接 CI 或 git hook。
CI 见 `.github/workflows/ci.yml`（Node 20/22：`node --check src/*.user.js` + `node tests/run-all.js -v`）。

## 约定

| 位置 | 约定 |
|------|------|
| `tests/<脚本名>/*.js` | **每个文件 = 一个可独立运行的测试**，用**退出码**表达结果（0=通过，非 0=失败）。不需要任何测试框架。目录名小写、与被测脚本同名（`ptautocheckin` / `btschoolhelper` …）。 |
| `tests/**/_*.js`、`tests/_*/` | 下划线开头 = 临时/草稿，**不参与** `run-all.js`（排查问题时可随意留）。 |
| `tests/run-all.js` | 运行器自身，不参与。 |
| `tests/lib/` | 共享基建（含 `lib/sim` 仿真站）。子目录内容**不会**被当作测试执行。 |
| `tests/fixtures/` | 测试数据（真实页面 HTML 样本等）。脱敏后再入库，勿含账号/会话信息。 |

**零依赖**：只用 Node 内置模块。本仓库刻意保持「无 `package.json` / 无 npm / 无构建」，测试不得引入任何 npm 包或框架。

### 给另一个脚本加测试（三步）

1. `mkdir tests/<脚本名>/`（小写、与 `src/<脚本名>.user.js` 同名）。
2. 在里面新建 `.js`，用退出码表达结果（`process.exit(0/1)`）；可直接 `require('../lib/...')` 复用基建。
3. `node tests/run-all.js --list` 确认被发现；**无需改运行器**。

## 三条纪律（`memory-bank/conventions.md` 第 8 节）

1. **鼓励为可测性设计**：逻辑尽量纯函数化、配置与逻辑分离、副作用收敛到 `main()`。
2. **禁止为测试留通道**：**不得**在生产代码里加 `if (window.__TEST__)`、把内部函数挂到 `window`、用 URL 参数开测试模式，或为断言方便加 DOM 标记。
3. **禁止为过测试改生产代码**：测试失败先查**测试自身**（断言/样本/环境），再查生产代码的真实缺陷；不得弱化断言、跳过分支、写死返回值来「变绿」。

> 违反第 2 条是最容易犯的错：想测一个函数，就把它 `window.xxx = fn` 暴露出去。正确做法见下一节。

## 如何测 userscript（核心技法）

生产脚本是**单文件 IIFE + 无 DOM 环境**，无法直接 `require`。本仓库验证过的做法是：
**把源文件里自包含的代码块切出来，写进临时模块再 `require`** —— 生产文件本身一行不改。

```js
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src', 'PTAutoCheckIn.user.js'), 'utf8');

// 1) 按注释标记切出自包含的一段(要求这段不闭包引用 IIFE 里的其它局部变量)
const a = src.indexOf('const AUDIT_RESERVE_MS');
const b = src.indexOf('// 全站预算审计');

// 2) 前置依赖也从源文件里抽(或读常量), 避免在测试里硬编码一份会漂移的副本
const prelude = [
    'const UNIT_TOTAL_TIMEOUT = 40000;',
    "const CLICK_CHECK_IN = { type: 'click_checkin', timeout: 5000 };"
].join('\n');

// 3) 写临时模块并 require —— module.exports 只出现在临时副本里, 生产文件保持干净
const tmp = path.join(os.tmpdir(), `ptac-${process.pid}.js`);
fs.writeFileSync(tmp, `${prelude}\n${src.slice(a, b)}\nmodule.exports = { computeUnitBudget };\n`);
const { computeUnitBudget } = require(tmp);
fs.unlinkSync(tmp);

// 4) 断言: 合法用例通过、非法用例被拒
```

要点与坑：

- **被切的代码块必须自包含**。若它闭包引用了 IIFE 里的其它局部变量，说明**生产代码该重构**（抽成不依赖闭包的纯函数 / 参数注入），而不是加测试后门 —— 这是 `conventions.md` §8.1 的正当理由。
- **临时文件放 `os.tmpdir()`**，文件名带 `process.pid` 避免并发撞车，用完 `unlinkSync`。
- **别把断言写在源文件里**：`check-ptac-budget.js` 的「D 段自测」就是这样做的 —— 它把 `computeUnitBudget` 抽出来喂**合成 unit**，从而能验证「自检本身是否写错了」（否则一个写错的自检会永远显示通过）。
- 需要 DOM 时优先**喂数据**而不是**造环境**：解析类逻辑把 HTML 当字符串/`DOMParser` 输入，别去 mock 整个 `document`。

## 仿真站：`tests/lib/sim/`（真浏览器 + 假站点，生产代码零改动）

> 仿真站是**共享基建**，放在 `lib/` 下（不是某个脚本的用例），各脚本的用例通过
> `require('../lib/sim/...')` 复用。

有些东西没法靠"切代码块"测 —— 脚本是否真的点了按钮、状态是否真的落盘、面板在宿主页面里
能不能被读穿。这些必须**真跑浏览器**。做法不是改脚本去适配 localhost，而是改浏览器的解析：

```bash
chrome --headless=new \
  --user-data-dir=<临时 profile> \
  --host-resolver-rules="MAP * 127.0.0.1:<port>" \
  --remote-debugging-port=0 --disable-popup-blocking
```

**URL 保留真实域名（`@match` / `matchUnit` 正常命中）、`Host` 头保留（服务器按 host 分派站点剧本），
但 DNS 指向本机。** 于是 `src/*.user.js` 一行都不用改，也不必加 `@match localhost`。

| 文件 | 作用 |
|------|------|
| `lib/sim/server.js` | 零依赖 http 服务器：按 `Host`+`?sim=` 路由站点剧本、`/__gm/*` 充当跨站共享的 GM 存储后端、`/__sim/*` 取请求日志 |
| `lib/sim/sites.js` | 站点剧本库（正常：`index` / `already` / `attended` / `ajax` / `none` / `slow`；恶意：`evil-favicon-exfil` / `evil-icon-javascript` / `evil-icon-data` / `evil-fake-button` / `evil-offsite-button` / `evil-xss-text` / `evil-megatext` / `evil-fake-success`；HDHome 型：`hdhome-index` / `hdhome-already` / `hdhome-gone` / `hdhome-guest` / `hdhome-attended`）。默认模型对齐 unit `tangpt`；HDHome 型（已签后入口变纯文本）由 `HOST_DEFAULT` 按 host 路由 |
| `lib/sim/gm-shim.js` | GM API 垫片（同步 XHR 打到 `/__gm/*`，复刻「脚本级跨源共享」语义），注入在 userscript **之前** |
| `lib/sim/cdp.js` | 迷你 CDP 客户端（用 Node 22 内置 `WebSocket`，零依赖） |
| `lib/sim/harness.js` | `withSim()`：起服务器 + 起一次性 Chrome（独立 profile）+ 注入 + 收尾 |
| `lib/sim/tcase.js` | 用例外壳：浏览器门禁（无浏览器打印 `SKIP` 退 0）+ 断言 + `waitStore()` 轮询 |
| `lib/hdui-scan.js` | **HDHomeUI 渲染扫描器**（五档：漏白 / 小件近白 / 残留装饰 / 对比度 / UA 界面）+ **金丝雀探针**（`canaries(page, ids)` 一次量完「是否还看得见」）。从 gitignore 的 `_verify-hdui-real-render.js` 提升而来 —— 不入库就永远无法回归 | P64 / P66 |

**用例里怎么用**（注意 require 路径：`tests/<脚本名>/` → `../lib/sim/`）：

```js
const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq, waitStore } = require('../lib/sim/tcase');

runCase('Sxx 某某', async () => {
    await withSim(async (sim) => {
        const page = await sim.open('http://www.tangpt.top/?sim=index', { waitMs: 8000 });
        const st = await waitStore(sim, 'ptac_status_tangpt', (v) => v && v.status === 'success', 25000);
        assertEq(sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' }).length, 1);
        await page.close();
    });
});
```

纪律与坑：

- **剧本用 `?sim=` 选择**：`matchUnit` 只比对 host + unit.url 里声明的 query，额外的 `sim` 参数不影响匹配，
  所以既能一域名多用，又不用改 `SITES` 配置。
- **断言要轮询不要 sleep**：脚本是异步写状态的，用 `waitStore()` 而不是固定 `waitMs` 后直接读。
- **GM 存储后端走服务器**：各假站 host 不同，浏览器 `localStorage` 是隔离的，必须由服务器持有唯一一份 store。
- **独立 profile + 用完即删**：带 `--host-resolver-rules` 的实例里所有域名都指向本机，
  只能当一次性测试浏览器，测完关闭；不得日常浏览或登录真实账号。
- **浏览器门禁不是弱化断言**：无 Chrome 时 `SKIP` 退 0 是环境分级；有浏览器时必须真过。
- **还有一道 Node 门禁**：`cdp.js` 用的是 **Node 22 内置的全局 `WebSocket`**（零依赖）。
  Node 20 没有它，`new WebSocket` 会直接 ReferenceError —— 所以 `runCase` 里加了第二道门禁，
  让"没有全局 WebSocket"也走 `SKIP`（否则仿真用例在 Node 20 上是**失败**而不是跳过）。
  ⚠️ 这道门禁只影响仿真用例：静态用例（`check-*`）不用 `runCase`，在 Node 20 上照跑不误。
- **新断言必须反向验证一次**：写完断言要故意把生产代码改错，确认它**真的会变红**，再改回来。
  2026-09-19 就吃过亏：用 `l.indexOf('评论') >= 0` 断言栏名，把栏名改成 `评论X` 时测试**照样通过**
  （子串匹配） —— 断言等于没写。文本断言要**完全匹配**，例如：
  ```js
  const re = new RegExp('^"?' + n + '(?:\\s*[↓↑])?"?$');   // "评论" / "评论 ↓" / "评论 ↑"
  ```
  （`getComputedStyle(...).content` 返回的字符串**带双引号**，匹配时要算进去。）
- **P0 结论要回真机复核**：CDP 注入 + GM 垫片是近似的（沙箱世界、存储时机），
  关键结论用真实 Tampermonkey（装 `src/` 原文件、同样加 `--host-resolver-rules`）再验一次。

## 现有测试

| 文件 | 覆盖 | 对应记录 |
|------|------|----------|
| `ptautocheckin/check-ptac-budget.js` | PTAutoCheckIn 的 **A** 常量不变式 / **B** 状态阶梯结构（`STATUS_TRANSITIONS`）/ **C** 配置区不透明步骤的 `budgetMs`/`alreadyCheckBudgetMs` 声明 / **D** 抽出 `computeUnitBudget` 喂 10 个合成 unit 自测 | `memory-bank/pitfalls.md` **P28** |
| `ptautocheckin/sim-security-s00-env-smoke.js` | 仿真站环境自检（真实域名落本地、Host 保留）+ 端到端被动签到冒烟（点击 → 跳转 → success） | 门禁；不过则其余仿真用例结论不可信 |
| `ptautocheckin/sim-security-s01-no-window-hook.js` | 无 `window.__*` 后门 / 无 `unsafeWindow` / 内部函数未挂 window（静态 + 运行时） | `conventions.md` §8.2 |
| `ptautocheckin/sim-security-s02-stored-xss.js` | 站 A 埋恶意按钮文案 → 进 GM 存储 → 站 B 面板渲染，XSS 不得执行 | P30 |
| `ptautocheckin/sim-security-s03-favicon-beacon.js` | favicon 外链不得跨站驻留（同站约束）+ 本站 icon 仍正常采集 | P30 / S03（已修） |
| `ptautocheckin/sim-security-s04-favicon-scheme.js` | `javascript:` / `data:` 伪协议 icon 不得落存储 | P30 / S04 |
| `ptautocheckin/sim-security-s05-panel-readable.js` | 宿主页面不得读穿面板（`closed` shadow） | P30 / S05（已修） |
| `ptautocheckin/sim-security-s07-forced-retry.js` | `?ptacRetry` 需一次性票据：外部链接无效、面板重试仍可用、票据不可重放、伪造 `ptacTask` 无效 | P30 / S07（已修） |
| `ptautocheckin/sim-security-s09-click-hijack.js` | 9a 站外伪造入口应被拒绝；9b 同站任意参数仍会点击（**已知残留风险**，含不修理由） | P30 / S09 |
| `ptautocheckin/sim-security-s11-cooldown-timeout.js` | 冷却期内不重复点击且不改写状态；无签到入口时在预算内收敛（不挂死） | P28 / P30 |
| `ptautocheckin/sim-security-s13-match-scope.js` | `@match` 全为 `*://*.域/*`（含明文 http + 任意子域）；子域上脚本会运行但不匹配 unit | P30 / S13（残留） |
| `ptautocheckin/sim-security-s15-megatext.js` | 1MB 按钮文案下主流程仍有结论、后续面板不崩、不进存储 | P30 / S15 |
| `ptautocheckin/sim-security-s17-static-baseline.js` | 无 `eval`/`new Function`/`document.write`/`insertAdjacentHTML`/`unsafeWindow`；无 `GM_xmlhttpRequest`/`@connect`；`@grant` 最小集 | P30 / S17 |
| `ptautocheckin/sim-hdhome-pagetext.js` | HDHome 型站点（已签后入口变纯文本）四态：已签页零点击直判 success / 未签点击 → 落地页跳回 → success / 入口消失且无已签文本仍判已签（通道冗余）/ **未登录页（同样无入口）不得判已签**（`noButtonMeansCheckedIn` 的盲区，见 P31） | 站点回归（2026.09.19） |
| `hdhomeui/check-hdui-static.js` | HDHomeUI 静态约束：元数据与最小权限（仅 `GM_getValue`/`GM_setValue`）/ **危险 API 禁令**（无 `.click()`、`dispatchEvent`、`.submit()`、`eval`、`innerHTML`、`cloneNode`、`fetch`、XHR、改站内 `href`、给站内挂 `onclick`）/ 无空 catch / 无 `window.__` 钩子 / 胶片墙**骨架特征逐条钉死** / 旧主题零残留 / 旧 id 迁移已登记 / 12 列契约与错误码齐备 | `scripts/HDHomeUI.md` §5 |
| `hdhomeui/sim-hdui-function-parity.js` | 上妆后「功能基线快照」逐字段不变（导航/信息栏/行链接/表单/分页/页脚）+ 关键元素 hit-test 可点 + RSS 点击恰好 1 次请求 + 搜索箱折叠与表单提交仍工作 + 局部重排不误判 | `TASK018` §8.2 |
| `hdhomeui/sim-hdui-theme-switch.js` | 胶片墙**骨架特征逐条钉死**（齿孔轨道 / 帧号 counter / 片头吸顶 / 做种占比条 —— 少一条就不叫胶片墙）；切回默认卸干净（无样式节点/无自定义属性残留）；记忆；面板真实点击；`Alt+Shift+T` 循环 | `TASK018` §4.6 |
| `hdhomeui/sim-hdui-icons.js` | **SVG 图标体系落地**：类别图标 `content` 是内联 SVG 且**宽度 > 0**（P42 固有尺寸）/ 指标图标 comments·size·seeders·leechers·snatched·**time** 全换 SVG / **站点自绘的零散族**（sticky·star·arrowup·arrowdown·inbox·sentbox·buddylist·rss·plus）逐个验「`content` 与 `background-image` 都换成 SVG」（.16 真站扫描发现的漏网族，站点是拿 background 画的 → 只换 content 会透底）/ 导航 16 项挂上 SVG 且**保种 ≠ 断种** / 站内 RSS 链接不被压成零宽 | P42 / P54 |
| `hdhomeui/sim-hdui-legacy-theme.js` | 旧主题 id（已删的 5 套）**静默迁到胶片墙**：上妆成功 + 不弹横幅 + 写回存储；真正无效的值才回落默认，且横幅说「主题设置无效」**而非**「页面结构与预期不符」、不进等待窗口、按钮是「改用胶片墙」 | P44 |
| `hdhomeui/sim-hdui-layout-width.js` | **不撑宽页面 / 窄屏导航可点 / 片头吸顶**：上妆后文档宽度 ≤ 原站（防 max-content 顶宽，P46）；用 `Emulation` 改视口，1024 / 900 下导航 16 项 0 被挡（flex 导航需 `max-width:100vw` 才会 wrap）；滚动 600px 后片头 `top≈0` | P46 |
| `hdhomeui/sim-hdui-structure-guard.js` | 缺列 `E_COLUMN_UNKNOWN` / 行列数不符 `ROW_CELL_COUNT_MISMATCH` / 缺锚点 `E_ANCHOR_MISSING` ⇒ 卸妆 + 红色横幅（含错误码）+ 控制台 error + 写 `hdui.lastError` + **零危险端点访问**；空表体与无种子表页不算错；运行中改坏结构自动回退 `E_STRUCTURE_CHANGED` | `TASK018` §5/§6 |
| `hdhomeui/sim-hdui-danger-guard.js` | 点自持 UI（浮动开关/面板项）与按快捷键**不冒泡到站内 document 监听**；切换主题零站内请求；反向证明站内监听与 RSS 仍存活；签到/登出/魔力入口未被挂 `onclick` | `TASK018` §6.2 |
| `hdhomeui/sim-hdui-film-fidelity.js` | **与原型 `film.html` 的保真度**（27 条，全部运行时实测）：列头 6 列补出 `::before` 图标 / 列头不是站点默认的白粗字 / 数据行左对齐（压住站点居中）/ 三层灰（dim·muted·金）/ 类别色块 34px·圆角 10 / **所有类别（含清单外的未知家族）都换成 SVG（兜底生效）** / 促销 `img.pro_*` 换成 16px 内联 SVG / 标签是药丸且**保留站点分类底色** / 标题与 RSS 同行 + 省略号 / 导航 7px 11px 与末 6 项弱化 / **导航项清掉站点的 `#dedede` 浅灰底 + 1px 白边（.15，站点那条已复刻进仿真页）** / **真实鼠标悬停有底色** / **color-scheme 已设 dark（.18：滚动条与下拉弹层是 UA 画的，扫描看不见）** / **7 个 `font.color_*` 统计值各有可读色位且两两不同**（.17，专防「7 条连写只有最后一条生效」）/ 入口胶囊 150×27 且不与导航项相交 / 面板 340px 卡片 | P48 / P49 / P53 / P55 / P56 / P58 / P61 |
| `hdhomeui/sim-hdui-meta-actions.js` | **标题格动作区与图标背景层**（真站独有，原型 `film.html` 里没有那四个按钮）：类别图标 `background-image` 已清成 `none`（站点那条带 `!important`，简写清不掉 → P50）/ 豆瓣·IMDb·下载·收藏 `content` 与 `background-image` **双双**换成 SVG / 四个 chip 竖排两列（评分列 \| 操作列）且**两两不重叠**（量矩形）/ 无种子表页 `table` 底色已压深（P51） | P50 / P51 / P52 |
| `hdhomeui/sim-hdui-css-validity.js` | **生成的 CSS 无「静默失败」**（P57）：把 `style#hdui-css` 按顶层 `{}` 逐条喂给 CSSOM，**切出来 N 条就必须解析出 N 条**（差多少就是多少条被浏览器静默丢掉，且把原文打印出来定位）/ 规则数 > 60 防 CSS 没生成 / CSS 体积 < 400KB 防「逐行生成」把样式撑爆。CSS 出错不报错也不渲染，前四档渲染扫描都发现不了 | P57 |
| `hdhomeui/check-hdui-hide-allowlist.js` | **隐藏类声明白名单（deny-by-default，静态）**：任何 `display:none`/`visibility:hidden`/`opacity:0`/`clip-path`/`content-visibility`/`text-indent:-`/`font-size:0` 都必须落在白名单里（多一条即红并打印原文）；禁 `!important` 隐藏、禁裸元素/通配、每条必须有 `//` 理由；`contain` 只许 `inline-size`；`overflow:hidden` / `z-index` / `position:fixed` 分别白名单化（后两者只准留在自持 UI 上） | P66 |
| `hdhomeui/sim-hdui-hide-allowlist.js` | **运行时 CSSOM 版白名单**：静态那份扫的是源码文本，而选择器是**运行时拼的**（`:nth-child(N)` / 拼接常量 / 可选列缺席时整段不生成），这里看浏览器**解析后真正生效的那张表**；外加「每条规则的选择器必须锚定已知根（`html[data-hdui-theme]` / `#torrenttable` / `ul#mainmenu`）」—— `table{display:none}` 级别的事故就靠这条拦 | P66 |
| `hdhomeui/sim-hdui-unknown-canary.js` | **未知元素金丝雀**（本轮核心）：站点改版冒出来的公告 / 新标签 / 新徽章 / 未登记图标，以及运行时注入的消息弹窗 / 提示框 / iframe，**一个都不许消失**。每条过 8 道断言：在 DOM / 面积 ≥ 8×8 / 可见性 / **hit-test 命中自身**（防被裁被压）/ **对比度 Δ≥40**（防隐形）/ 图标至少一层是内联 SVG（防被清成空白）/ 面积不低于不上妆对照组的 60% / 注入后不许卸妆。分三组：加载期自带 / 运行期注入 / **非种子页**（我的·论坛·详情页 —— 主题那三条兜底是全局规则，在那里一样生效） | P66 |
| `hdhomeui/sim-hdui-overlay-safety.js` | **浮层 / 弹窗 / 公告专项**：body 上与 `#torrenttable` 内的 fixed 弹窗**上妆前后位置一致**（专抓 `contain` 改定位基准；实测 `inline-size` 安全、改成 `strict` 必红）/ 弹窗关闭按钮点得到 / 滚动后站内消息条不被片头压住 / 站点提示框 `niceTitle` 切成 visible 后仍可读 / 错误横幅存在时站内消息条没被删也没被隐藏，关掉横幅后可点 | P64 / P66 |
| `hdhomeui/sim-hdui-unknown-tags.js` | **未知列 / 未知分组行一律卸妆**（P69 用户裁决）：`E_COLUMN_UNEXPECTED` / `E_ROW_UNKNOWN` ⇒ 直接回退 + 横幅写明错误码 + 写 `lastError`，**不进等结构窗口**；卸妆后未知内容本身仍可见可点；行结构**逐行**校验（剧本 `hdhome-ui-laterow` 专抓「只查 rows[1]」的盲区）；新标签保留站点分类底色、未知图标有 SVG 兜底 | P69 / P68 |

## 待铺的路（候选，按价值排序）

1. **PTAutoCheckIn 场景矩阵**（TASK015 的 T14）——每项对应一个已发现缺陷，防重构回归：
   慢加载不误判 failed / 冷却与 `detect_only` 与 `suspect` 不被超时改写 / 双标签并发 `success` 不被覆盖 / 慢跳转不误判 / 预算不变式 / 既有行为基线（跨天守卫 P23、P25 重现降级恢复、P27 文本站信号等价性）。
2. **纯函数抽取**（TASK015 的 T13）——把状态阶梯守卫、预算计算、`deriveStateSignals`/`readEntryState`、超时分类抽成不依赖闭包的函数，使 1 的矩阵可直接断言。**注意**：抽取后阶梯/预算的逻辑副本会消失，`check-ptac-budget.js` 的 C 段正则检查届时可改为直接 import。
3. **BTSchoolHelper `parseTorrentTable` 回归**——用真实样本 HTML 断言列定位与字段值；可先为现存 Bug（P2 时魔浮点、P10 命名不一致）写失败断言，再修生产代码。
4. **仓库元数据一致性检查**——遍历 `src/*.user.js` 校验 `@version` 格式（`YYYY.MM.DD.N`）、`@match` 与 `SITES` 域名是否对得上、`@grant` 与用到的 GM API 是否匹配（TASK010 发布自动化的前置）。

> 关于 fixture：`src/BTSchoolTorrentsTableSample.html` 目前放在 `src/`（历史上与脚本同目录便于对照）。若第 3 项落地，建议迁到 `tests/fixtures/` 并同步更新 `conventions.md` §7、`techContext.md`、`scripts/BTSchoolHelper.md` 的引用。

## 与知识库的关系

- 新增/改名测试后，同步更新：本文件「现有测试」表、`memory-bank/techContext.md` 的「测试」条目、`memory-bank/conventions.md` §7/§10（若改变了工作流）、`memory-bank/projectbrief.md` 的仓库结构块。
- 测试暴露出的真实缺陷 → 记入 `memory-bank/pitfalls.md`（症状 → 原因 → 对策），必要时在 `memory-bank/tasks/` 建任务。
- 本目录文件**无 `@version` 头**，不参与「版本号铁律」（该铁律只约束 `src/*.user.js`）。
