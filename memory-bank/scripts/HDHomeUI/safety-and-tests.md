# HDHomeUI 安全与错误处理、测试
> 摘要: ## 5 安全与错误处理, ## 6 测试
> 触发: 查安全与错误处理, 查测试用例

## 5. 安全与错误处理

- **危险 API 静态禁令**（`tests/hdhomeui/check-hdui-static.js` 逐条扫描）：
  无 `.click()`、`dispatchEvent`、`.submit()`、`eval`、`new Function`、`innerHTML`、
  `cloneNode`、`fetch` / `XMLHttpRequest` / `GM_xmlhttpRequest`、不得改站内 `href` / 挂 `onclick`。
- **不静默**：统一 `Diag` 账本（info/warn/error + `Diag.fail(code, err)`），
  `window` 的 `error` 与 `unhandledrejection` 只记录不吞（不 `preventDefault`）；
  禁止空 catch（静态扫描）；fatal 必弹可见横幅。
  ⚠️ **`unhandledrejection` 是页面级事件，前缀 ≠ 来源**：日志必须带 stack 首帧并显式声明
  「来自页面或其它脚本，非 HDHomeUI 故障」，否则会把别的脚本的异常记在本脚本头上（P43）。
  该免责的前置条件是「本脚本零异步」，由 `check-hdui-static.js` 断言守护。
- **运行时守卫**：`MutationObserver` 观察 `#outer`（取不到则退到 `document.body`）的 `childList`
  （debounce 500ms），局部刷新后重新校验；坏了就回退，没坏就重画 `--hdui-cat` / `--hdui-ratio`。
  ⚠️ **`unload()` 必须先 `stopWatch()`**：否则回退到默认界面后 MutationObserver 仍在空转（白占资源）。
- **启动时序**：`document-start` 调 `paintBootBgWhenPossible()` 铺底色 → `DOMContentLoaded` 才 `stopBootWatch()`
  + `mountUi()` + `applyStored()`。铺底色失败独立记 `E_BOOT_PAINT`，不影响后续上妆；
  上妆成功时 `unload()` 会先把底色样式撤掉，由主题 CSS 接管。
- **防误触清单**（本页特有）：不碰签到 `attendance.php`、RSS 增删 `myrss.php`、
  登出 `logout.php`、魔力 `mybonus.php` —— 脚本从不主动访问，测试断言这些端点零请求。

---

## 6. 测试

| 用例 | 覆盖 |
|---|---|
| `tests/hdhomeui/check-hdui-static.js` | 元数据 / 最小权限 / 危险 API 禁令 / 无空 catch / 无 window 钩子 / 5 主题齐备且结构声明互异 / 契约定义完整 / **启动时机与默认行为**（`unload()` 停守卫、首次安装默认 `default`、铺底色早于 readyState 分支）/ **§14 未知元素不屏蔽**：`#torrenttable` 重置 `color`、促销徽章兜底且排在枚举之前、`FONT_BLACK` 覆盖两种写法并同时管 `<font color>` 与 inline style、inline 白底兜底含 6 位 `#ffffff` |
| `tests/hdhomeui/sim-hdui-function-parity.js` | 胶片墙上妆后功能基线快照逐字段不变、关键元素 hit-test 可点、RSS 点击恰好 1 次请求、搜索箱折叠与表单提交仍工作、局部重排不误判 |
| `tests/hdhomeui/sim-hdui-theme-switch.js` | 版式签名两两不同、各套骨架特征、切回默认卸干净、记忆、面板点击、快捷键 |
| `tests/hdhomeui/sim-hdui-structure-guard.js` | 缺列 / 行列数不符 / 缺锚点 ⇒ 回退 + 横幅 + 记录 + 零危险访问；空表体与无表页不算错；运行中改坏自动回退 |
| `tests/hdhomeui/sim-hdui-danger-guard.js` | 自持 UI 点击不冒泡到站内监听、切换零站内请求、站内监听与 RSS 仍存活、危险入口未被挂 onclick |
| `tests/hdhomeui/sim-hdui-icons.js` | **图标真的画出来了**（不只是"没回归"）：类别/指标图标 `content` 是内联 SVG 且**宽度 > 0**（P42 固有尺寸）；导航 16 项挂上 SVG 且**保种 ≠ 断种**；站内 RSS 链接不被压成零宽 |
| `tests/hdhomeui/sim-hdui-film-fidelity.js` | 与原型 `film.html` 的保真度（列头补充图标 / 非白粗字 / 数据行对齐 / 类别色块 34px / 三层灰 / 促销徽章 / 标签药丸 / 导航弱化 / 入口尺寸） |
| `tests/hdhomeui/sim-hdui-meta-actions.js` | **标题格动作区与图标背景层**：类别图标 `background-image` 已清成 `none`（P50，站点那条带 `!important`）；豆瓣/IMDb/下载/收藏 `content` 与 `background-image` 双双换成 SVG；四个 chip 竖排两列、两两不重叠（P52）；无种子表页 `table` 底色已压深（P51） |
| `tests/hdhomeui/sim-hdui-inline-dock.js` | 入口内嵌（不悬浮、不压站内内容） |
| `tests/hdhomeui/sim-hdui-layout-width.js` | 不撑宽页面 / 窄屏导航可点 / 片头吸顶 |
| `tests/hdhomeui/sim-hdui-legacy-theme.js` | 旧主题 id 静默迁到胶片墙，不冒充结构错误 |
| `tests/hdhomeui/sim-hdui-optional-columns.js` | A / A·GB 缺席或晚到都不误判（10 列仍上妆 / 补进来自动重摆 / 撤走不回退 / 半状态不弹横幅且自愈） |
| `tests/hdhomeui/check-hdui-hide-allowlist.js` | **隐藏类声明白名单（静态，deny-by-default）**：白名单外的隐藏声明即红；禁 `!important` 隐藏、禁裸元素/通配、每条必须有理由；`contain` / `overflow` / `z-index` / `position:fixed` 一并白名单化 |
| `tests/hdhomeui/sim-hdui-hide-allowlist.js` | **运行时 CSSOM 版白名单** + 每条规则的选择器必须锚定已知根（防 `table{display:none}` 级别事故） |
| `tests/hdhomeui/sim-hdui-unknown-canary.js` | **未知元素金丝雀**（核心）：公告 / 新标签 / 新徽章 / 未登记图标 / 弹窗 / 提示框，一个都不许消失（8 道断言，见 P66）。三组：**加载期自带** / **运行期注入** / **非种子页**（我的·论坛·详情页 —— 主题那三条兜底是**全局规则**，在那里一样生效，不能只测种子页） |
| `tests/hdhomeui/sim-hdui-overlay-safety.js` | 浮层/弹窗专项：fixed 弹窗位置不被 `contain` 改动、关闭按钮点得到、片头不压站内浮层、提示框可见态可读、错误横幅不吞站内消息条 |
| `tests/hdhomeui/sim-hdui-unknown-tags.js` | 未知列 / 未知分组行一律卸妆 + 行结构逐行校验 + 新标签保留站点底色、未知图标有 SVG 兜底 |
| `tests/hdhomeui/verify-hdui-real-page.js` | **真站脱敏整页离线渲染验收**（P49 硬要求，从 gitignore 提升入库）。缺样本/缺浏览器则 SKIP 退 0；有样本时验：仍正常上妆 / 不撑宽 / CSS 无静默失败 / 图标全换 SVG / 标签保留底色 / 置顶双层有背景 / 五档扫描全无 / color-scheme=dark。**只输出结构·几何·颜色·计数**（铁律 5）。⚠️ 量之前要等 CSS 过渡跑完（导航项 `transition:background .14s`，上妆瞬间读到的是 `rgba(222,222,222,.616)` 中间态，会被小件近白扫描误报）—— 等时间，不要放宽阈值 |

仿真剧本：`tests/lib/sim/hdhome-ui-page.js`（**结构化复刻、零私有数据**，
变体 `hdhome-ui` / `-broken` / `-shape` / `-nocalc` / `-empty` / `-notable` / `-nonav` /
`-unknown`（公告 + 新标签 + 未登记图标）/ `-unknown-notable`（**非种子页** + 公告）/ `-extracol` /
`-grouprow` / `-grouprow-first` / `-laterow`）；
共享工具 `tests/lib/hdui-help.js` 与 **`tests/lib/hdui-scan.js`**（五档渲染扫描 + 金丝雀探针）；
`harness.withSim(fn, { scriptPath })` 支持测任意脚本
（**缺省注入的是 PTAutoCheckIn**，测本脚本必须显式传 `{ scriptPath: H.HDUI_PATH }`）。

> **判据纪律（写新断言时照抄）**：只看"元素存在/矩形非零"抓不到屏蔽 ——
> 必须叠加 **hit-test**（防被裁被压）、**对比度 Δ≥40**（防隐形；取 20 会让"纯黑字压片基"蒙混过关）、
> **图标至少一层是内联 SVG**（防被清成空白）。每条断言都要用"删掉对应生产兜底"反向验证一次。

---

