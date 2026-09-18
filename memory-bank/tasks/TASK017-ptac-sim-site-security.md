# TASK017 — PTAutoCheckIn 本地仿真站与安全测试矩阵

> 状态：**In Progress —— M1~M3 已完成（仿真站 + 11 个用例 + 4 项已修），等用户审核后提交；M4 补全 / M5 残留项待定**
> 实测结论与修复清单见 `memory-bank/pitfalls.md` **P29 / P30**；用法见 `tests/README.md`「仿真站」章节。
> 归属：`TASK016 测试基础设施与全面测试` 的能力延伸；本任务聚焦**安全方向**的验证与加固。
> 铁律提醒：本文件为**计划文档**，落地实施属于独立任务；实施时不得为测试改动 `src/`（见 §4 约束）。

---

## 0. 一句话结论

**可行，且成本比预想低。** 关键是实测通过的一条 Chrome 启动参数：
`--host-resolver-rules="MAP * 127.0.0.1:8080"` —— 它让**真实域名**的 URL（`http://www.m-team.cc/index.php`）
在浏览器里保持原样（`@match` 正常命中、`Host` 头保留），但 DNS 解析被指向本地仿真服务器。
**因此生产脚本一行都不用改**（不用加 `@match localhost`，不用重写 `SITES.url`），就能跑在完全可控的假站上。

---

## 1. 可行性验证（已实测，非推断）

| # | 假设 | 验证方式 | 结果 |
|---|------|----------|------|
| F1 | Chrome 能把任意域名解析到本地服务器 | 起 Node http 服务监听 `127.0.0.1:8080`；`chrome --headless=new --host-resolver-rules="MAP * 127.0.0.1:8080" --dump-dom http://www.m-team.cc/index.php` | ✅ 返回 `<h1>SIM_OK host=www.m-team.cc path=/index.php</h1>`，**Host 头与路径完整保留** |
| F2 | 本机浏览器可用 | 探测 | ✅ `C:\Program Files\Google\Chrome\Application\chrome.exe` 与 Edge 均在 |
| F3 | 零依赖可写 CDP 驱动（不引 npm） | `node -e "typeof WebSocket"`（Node 22.22.2） | ✅ 内置 `WebSocket` + `fetch`；可直接连 `--remote-debugging-port` |
| F4 | 脚本攻击面可静态枚举 | 全文件 grep | ✅ **无** `eval` / `new Function` / `document.write` / `insertAdjacentHTML`；**无** `GM_xmlhttpRequest` / `@connect`；仅 4 个 `@grant` |
| F5 | HTTPS 可用（HSTS/HTTPS-First 兜底） | `openssl version` | ✅ OpenSSL 3.5.7 可用，可自签证书 + `--ignore-certificate-errors`；默认走 http 即可 |
| F6 | 面板是否隔离 | 读源码 L2424 | ⚠️ `attachShadow({mode:'open'})` —— **宿主页面可读面板全部内容**（见 S05） |

**不可行/不做的事**（明确排除，避免走弯路）：
- ❌ 改 hosts 文件（需管理员，且污染全局）
- ❌ 引入 Playwright / Puppeteer / jsdom（仓库铁律：无 `package.json`、无 npm；`tests/` 只用 Node 内置模块）
- ❌ 中间人代理 + 自签 CA（比 host-resolver 复杂一个量级，没额外收益）
- ❌ 对真实 PT 站做任何探测/渗透（只跑本地仿真）

---

## 2. 威胁模型（安全测试的设计依据）

**信任边界**：

```
[ 站点服务器 / 页面内容 (不可信) ]
        │  DOM 文本、属性、favicon、跳转目标、URL 参数
        ▼
[ 用户脚本 (唯一可信计算体，但运行在宿主页面 DOM 里) ]
        │  GM_getValue / GM_setValue  ← 脚本级共享、跨所有 @match 域可读
        ▼
[ GM 存储 (跨站共享的"迷你数据库"，~28 域名共享同一份) ]
        │  面板渲染（注入宿主 DOM 的 open shadow）
        ▼
[ 用户：看到的状态、被诱导的动作 ]
```

**核心矛盾**：脚本把「站点页面内容」当作事实来源（按钮文案 = 签到状态），把「GM 存储」当作跨站共享的真相库，
把「面板 UI」注入到宿主页面的 DOM 里。这三条各有一个可被站点利用的通道。

### 攻击面清单（A1–A8）

| ID | 攻击面 | 利用路径 | 影响的资产 |
|----|--------|----------|-----------|
| A1 | **跨站共享存储** | 站 A 的页面内容 → 被脚本抓取 → 写入 GM 存储 → 在站 B 的面板里渲染 | 存储型 XSS（跨源）、状态完整性 |
| A2 | **外链 favicon** | `<link rel="icon" href="http://evil/p.png">` → 存入 `ptac_favicon_*` → 此后**任意** PT 站开面板都会请求 evil | 隐私（跨站跟踪信标）、明文请求 |
| A3 | **open shadow DOM** | 宿主页面 `document.getElementById('ptac-root-v2').shadowRoot` | 隐私（一个 PT 站可枚举用户全套 34 个站点的今日状态与配置） |
| A4 | **URL 参数强制动作** | `?ptacRetry=<uid>` 触发 `forceCooldown:true`，**无视 10 分钟冷却**直接点击 | 账号风控（诱导用户点链接即可反复签到） |
| A5 | **选择器欺骗 / 点击劫持** | 伪造符合 `checkInSelector` + `checkInContent` 的元素，href 指向攻击者构造的同站 URL | 以用户身份发起非预期请求（CSRF 放大） |
| A6 | **状态欺骗** | 伪造"已签到"文案 → 脚本写 `success`；或伪造成未签 → 反复点击 | 状态完整性 / 风控 |
| A7 | **`@match` 过宽** | `*://*.m-team.cc/*`：任意子域 + **明文 http** 都在作用域内 | 攻击面放大（用户内容子域、MITM） |
| A8 | **资源/健壮性** | 超大 DOM 文本（1MB 按钮文案）、永不出现的元素、高频渲染 | 存储膨胀、渲染卡死、预算耗尽 |

---

## 3. 仿真站架构设计

### 3.1 目录布局（全部落在 `tests/`，`src/` 零改动）

```
tests/
├── sim/                          # 仿真站本体（子目录，不参与 run-all.js 执行）
│   ├── server.js                 # 零依赖 http(+可选 https) 服务器
│   ├── sites.js                  # 站点剧本库（按 Host+path 路由 → 场景）
│   ├── gm-store.js               # GM 存储后端（/__gm/get|set|dump|reset, CORS *）
│   ├── gm-shim.js                # 注入页面的 GM_getValue/setValue/openInTab/log（同步 XHR 后端）
│   ├── cdp.js                    # 迷你 CDP 驱动（Node 内置 WebSocket）
│   └── run.js                    # 用例运行器：起服务 → 起 Chrome → 跑剧本 → 断言 → 收尾
├── sim-security-s01.js … s18.js  # 顶层用例（每个文件 = 一个可独立运行的测试，退出码表达结果）
└── README.md                     # 补充「仿真站」章节（现有测试的浏览器门禁说明）
```

### 3.2 服务器职责

1. **路由**：按 `Host` + `pathname` 决定返回哪个「站点剧本」；未登记的域名返回 404（便于发现意外请求）。
2. **剧本库**（可组合，覆盖真实站点四大形态 + 恶意变体）：
   - 正常：`index`(未签) / `already`(已签) / `nav`(点击后整页跳转) / `ajax`(同页文案) / `slow`(延迟) / `no-button`
   - 恶意：`evil-fake-button`(伪造按钮+危险 href) / `evil-fake-success` / `evil-favicon-exfil` /
     `evil-icon-javascript` / `evil-icon-data` / `evil-megatext`(1MB 文案) / `evil-hidden-click`
3. **请求日志**：记录 `{t, host, path, ua, referer}` → 供「外链信标」「点击次数」「冷却是否生效」断言。
4. **GM 存储后端**：`/__gm/get|set|dump|reset`，所有假站共享 → 精确复刻 Tampermonkey「脚本级跨源共享」语义。
5. **控制接口**：`/__sim/log`（取日志）、`/__sim/reset`（清日志与存储，保证用例隔离）。

### 3.3 脚本注入方式（两档，按保真度选择）

| 档 | 方式 | 保真度 | 用途 |
|----|------|--------|------|
| **T1 真机** | 独立 profile 的 Chrome + 真实 Tampermonkey 装 `src/PTAutoCheckIn.user.js` | ★★★★★ | 人工抽查、最终验收、无法 shim 的行为（真实 GM 存储/多标签调度） |
| **T2 自动** | CDP `Page.addScriptToEvaluateOnNewDocument`（带 `worldName` 近似隔离世界）+ `gm-shim.js` | ★★★☆☆ | CI/批量回归，S01–S18 主力 |

> T2 的已知近似：TM 的沙箱世界、GM 存储的持久化时机与 T2 的同步 XHR 后端不同；
> **每个安全结论在 T2 命中后，挑关键的在 T1 复核一次**，避免把 shim 的行为误判成脚本的行为。

### 3.4 浏览器启动参数（重要：必须用独立 profile）

```bash
chrome.exe \
  --user-data-dir=%TEMP%\ptac-sim-profile \      # 独立 profile，绝不碰用户主 profile
  --host-resolver-rules="MAP * 127.0.0.1:8080, EXCLUDE localhost" \
  --disable-popup-blocking --no-first-run --no-default-browser-check \
  --disable-features=HttpsFirstBalancedMode --ignore-certificate-errors \   # https 兜底
  --remote-debugging-port=9222
```

⚠️ **安全提醒**：带 `--host-resolver-rules` 的实例里**所有域名都指向本机**，
只能作为一次性测试浏览器使用，测完关闭；不得用于日常浏览、不得登录真实账号。

---

## 4. 硬约束（实施时必须遵守）

1. **不改 `src/`**：命中 `@match` 靠 host-resolver，不靠改 `@match`；站点数据靠仿真服务器，不靠改 `SITES`。
2. **零依赖**：只用 Node 内置模块（`http`/`https`/`child_process`/`WebSocket`/`fetch`）；不新增 `package.json`。
3. **不留测试后门**：不往生产代码加 `window.__TEST__`、不挂内部函数到 `window`（`conventions.md` §8.2）。
4. **发现缺陷先记录**：测试暴露的问题写进 `memory-bank/pitfalls.md`，**修生产代码另起任务并等用户确认**（铁律 #1/#2）。
5. **浏览器门禁**：`tests/run-all.js` 跑不到 Chrome 时，仿真用例打印 `SKIP(无浏览器)` 并**退出 0**；
   本机/CI 需显式加 `--with-browser` 才强制要求通过。门禁≠弱化断言，只是环境分级。

---

## 5. 测试用例矩阵（S01–S18）

> 优先级：**P0 = 预期能挖到真问题**；**P1 = 基线防回归（当前应通过，锁定行为）**；**P2 = 健壮性**。
> 「预期」列是分析源码得出的**假设**，实测可能不符 —— 以实测为准，不符要查测试自身。

### A. 存储与 XSS（A1）

| ID | 场景 | 断言 | 预期 | 优先级 |
|----|------|------|------|--------|
| S01 | 页面 JS 尝试直接调用 `GM_setValue` / 找 `window` 上任何 `ptac*` 符号 | 均不可达（`undefined`） | 通过 | P1 基线 |
| S02 | 站 A 放"重现的签到按钮"，文案为 `<img src=x onerror="window.__pwned=1">`；再到站 B 打开面板 | 站 B 页面 `window.__pwned` 不存在；面板内无新增 `img`；状态显示正常 | 通过（`esc()` 全量转义 + `textContent` 兜底） | P1 基线 |
| S03 | 站 A 设 `<link rel="icon" href="http://evil.test/beacon.png">`；再到站 B 开面板 | sim 服务器收到 `evil.test` 请求 | **命中**：跨站信标，站 B 的浏览行为被站 A 埋点 | **P0** |
| S04 | 站 A 设 favicon 为 `javascript:...` / `data:text/html,...` | `ptac_favicon_*` 不被写入（保持旧值或空） | 通过（已有 `^https?:` 过滤） | P1 基线 |

### B. 面板隐私（A3）

| ID | 场景 | 断言 | 预期 | 优先级 |
|----|------|------|------|--------|
| S05 | 宿主页面执行 `document.getElementById('ptac-root-v2').shadowRoot.textContent` | 能读出**全部 34 个 unit 的名称 + 今日状态** | **命中**：`mode:'open'` 导致一个 PT 站可枚举用户全套站点画像 | **P0** |
| S06 | 站点 CSS/JS 能否影响面板外观（样式注入冲突） | 面板在极端宿主 CSS（`* {all:unset}`）下仍可用 | 待定 | P2 |

### C. 强制动作 / CSRF 放大（A4）

| ID | 场景 | 断言 | 预期 | 优先级 |
|----|------|------|------|--------|
| S07 | 10 分钟内连续两次打开 `http://<site>/?ptacRetry=<uid>` | sim 记录到 **2 次** `/attendance.php` 点击（冷却被无视） | **命中**：任何人诱导用户点该链接即可反复签到 → 风控 | **P0** |
| S08 | 打开 `?ptacTask=<伪造id>` | 无任务时不执行任何点击（不进入后台任务分支） | 通过 | P1 基线 |
| S09 | 伪造按钮 `<a href="attendance.php?action=attacker">[签到得魔力]</a>`（href 满足选择器但参数恶意） | 脚本点击并导航到攻击者构造的 URL | **命中**：点击劫持/CSRF 放大 | **P0** |

### D. 状态完整性（A6）

| ID | 场景 | 断言 | 预期 | 优先级 |
|----|------|------|------|--------|
| S10 | 伪造"签到已得"文案 | 状态被写 `success` | 命中（设计使然）→ 记录为**已知风险接受**，建议加落地页二次确认 | P2 |
| S11 | 伪造"未签到"态 + 5 秒内二次访问 | 第二次**不点击**（`MIN_INTERVAL` 冷却生效） | 通过 | P1 基线 |
| S12 | 冷却期内在 `detect_only` 站反复访问 | 只检测不点击，状态不被超时改写成 `failed` | 通过（P28 阶梯） | P1 基线 |

### E. 作用域过宽（A7）

| ID | 场景 | 断言 | 预期 | 优先级 |
|----|------|------|------|--------|
| S13 | 访问 `http://cdn.m-team.cc/evil.html`（未登记的子域） | 脚本运行；若页面含伪造按钮则会被点击 | **命中**：`*://*.domain/*` 覆盖任意子域 + 明文 http | **P0** |
| S14 | 贴吧 `f?kw=pt` 命中 / `f?kw=other` 不命中 / `f?kw=pt&ie=utf-8` 命中 | 匹配边界正确 | 通过 | P1 基线 |

### F. 健壮性（A8）

| ID | 场景 | 断言 | 预期 | 优先级 |
|----|------|------|------|--------|
| S15 | 按钮文案 1MB | 写入被截断或渲染不崩溃；其它站面板仍正常 | 待定（怀疑渲染卡顿/存储膨胀） | P2 |
| S16 | 元素永不出现 + 页面永不 load | 在 `UNIT_TOTAL_TIMEOUT`(40s) 内收敛为 `unconfirmed`，不挂死 | 通过（预算不变式） | P1 基线 |

### G. 静态基线（无需浏览器，零成本，进 `tests/`）

| ID | 检查 | 预期 | 优先级 |
|----|------|------|--------|
| S17 | 源码无 `eval` / `new Function` / `document.write` / `insertAdjacentHTML` / 远端脚本加载 | 通过 | P1 |
| S18 | `@grant` 与代码实际用到的 GM API 一致；无 `GM_xmlhttpRequest` / `@connect`（无跨域外发） | 通过 | P1 |

---

## 6. 实施里程碑

| 里程碑 | 内容 | 产出 | 依赖 |
|--------|------|------|------|
| **M0** | 可行性验证 | ✅ 已完成（本文件 §1） | — |
| **M1** | 仿真服务器骨架 | `tests/lib/sim/server.js` + `sites.js`：Host 路由、5 个正常剧本、请求日志、`/__sim/*` 控制接口；`curl` 手工验证 | M0 |
| **M2** | GM shim + CDP 驱动 + 冒烟 | `gm-store.js` / `gm-shim.js` / `cdp.js` / `run.js`；端到端跑通「被动签到 → success」 | M1 |
| **M3** | 安全矩阵 P0 | S03 / S05 / S07 / S09 / S13 落地并实测，结论写 `pitfalls.md` | M2 |
| **M4** | 矩阵补全 + 功能复用 | S01–S18 全部；顺带用同一套环境实现 `TASK016` 的「场景矩阵」（TASK015 的 T14） | M3 |
| **M5** | 加固评审（**另起任务**） | 按实测结论给修复方案（如 S05 改 `closed`、S03 加 icon 同源白名单、S07 加一次性 token、S09 校验 href、S13 收紧 `@match`），**等用户确认后再动 `src/`** | M4 |

**规模估计**：M1 ≈ 1 次会话；M2 ≈ 1–2 次会话（CDP 驱动是主要不确定性）；M3 ≈ 1 次会话；M4 ≈ 2 次会话。
建议 **M1→M2 连续做完再停一次给用户看冒烟结果**，避免驱动方向跑偏。

---

## 7. 已知风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Chrome 自动更新导致 `--host-resolver-rules` / `--headless=new` 行为变化 | 仿真失效 | M1 里加一条「环境自检」用例，失败即明确报"浏览器参数不兼容" |
| HSTS 预加载域名强制升级 https（如个别域在 preload 列表） | 该站点无法用 http 仿真 | openssl 自签证书 + `--ignore-certificate-errors`；服务器同时监听 https |
| T2 shim 与真实 TM 语义偏差 → 误判 | 结论失真 | 每条 P0 结论在 T1（真机 TM）复核一次 |
| 仿真站被误提交/误当成生产代码 | 仓库污染 | 全部在 `tests/lib/sim/`（子目录不参与 `run-all.js`）；文档明确标注 |
| 独立 profile 里残留测试数据 | 隐私 | 每次运行前 `--user-data-dir` 指向全新临时目录，结束即删 |

---

## 8. 进度日志

- **2026-09-18（方案）**：完成可行性分析。**F1 实测通过**（Chrome `--host-resolver-rules="MAP * 127.0.0.1:8080"` →
  真实域名 URL 由本地服务器应答且 `Host` 头保留）→ 生产脚本可零改动命中 `@match`。
  完成威胁模型 A1–A8 与用例矩阵 S01–S18 设计，输出本计划。**未改动任何代码，待用户确认后进入 M1。**
- **2026-09-18（实施 M1–M3）**：用户确认后开工，全部按计划落地：
  - **M1 仿真站**：`tests/lib/sim/`（`server.js` 零依赖 http + 站点剧本路由 + `/__gm` 跨站共享存储后端 + 请求日志；
    `sites.js` 14 个剧本；`gm-shim.js` GM 垫片；`cdp.js` 内置 WebSocket 驱动；`harness.js` `withSim()`；`tcase.js` 用例外壳）。
  - **M2 打通**：S00 环境自检 + 被动签到冒烟一次跑通（点击 → 跳转落地页 → success，全程 8.9s）。
  - **M3 用例**：11 个用例全部通过（`node tests/run-all.js` → 13/13，含原 `check-ptac-budget`）。
  - **实测结论**：4 项 P0 全部复现（S03 favicon 跨站信标 / S05 宿主页面读穿面板 / S07 `?ptacRetry` 强制动作 / S09a 站外伪造入口），
    并**额外挖出一个 P0 崩溃 Bug**（P29：面板渲染 `st.status` 空指针 → 首次安装时主流程 100% 不执行）。
  - **已修复**（`@version` 2026.09.18.2 → .4）：P29 空值守卫；S03 icon 同站约束；S05 shadow 改 `closed`；
    S07 一次性票据 `ptacToken`；S09a 站外 href 护栏 + `refused` 语义（拒绝点击时记 `failed`，不谎报 pending）。
  - **未修（已评估，见 P30）**：S09b 同站任意参数入口、S13 `@match` 过宽 —— 两者都会影响真实站点行为，
    必须真站回归后再定。**已提交：`e2d5f52`（分支 `dev`，尚未 push）。**
- **待办**：M4（把 TASK015/T14 的功能场景矩阵也搬到这套环境）+ M5（S09b / S13 的真站回归与加固决策）。
