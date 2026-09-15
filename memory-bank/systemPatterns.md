# 系统模式（System Patterns）

> 记忆库核心文件：系统架构、关键技术决策、设计模式、组件关系。详细代码约定见 [conventions.md](./conventions.md)。

## 总体架构

无构建、无依赖、无服务端。每个脚本是一个自包含的 `.user.js`，注入用户浏览器（Tampermonkey）。按「**配置数据 + 通用执行引擎**」模式组织（尤其 PTAutoCheckIn）：

```text
src/*.user.js
└─ 元数据头（@name/@version/@match/@grant/@run-at...）
└─ IIFE: (function () { 'use strict'; ... })();
   ├─ ScriptName 常量（日志前缀）
   ├─ 配置数据（SITES 数组 / group+unit 两级 / TorrentState 映射）
   ├─ 通用引擎（executeStep / runUnit / parseTorrentTable...）
   └─ main() 入口（副作用收敛到此处）
```

## 关键技术决策

1. **配置与逻辑分离**：站点/规则配置集中为数据（如 `SITES` 数组——PTAutoCheckIn 为 group+unit 两级配置、`TorrentState` 映射），引擎只写一套（`executeStep`、`runUnit`、`parseTorrentTable`）。新增站点/单元时**只改配置不改引擎**。
2. **签到原子单位 = 页面入口 unit**：从 v1 的「按域名」细化为「按页面入口 unit」（解决贴吧多吧），每个 unit 独立冷却/状态/存储 key。
3. **被动检测 + 冷却分离**：每次访问都执行已签检测（不受冷却限制），冷却只防「重复点击」，避免风控/封号。
4. **GM 存储跨域共享**：PTAutoCheckIn 用 `GM_*` 按脚本共享、跨域可读，实现跨站 FAB 面板同一份数据。
5. **DOM 快照跨天守卫**：脚本注入时记录页面出生日期，凡基于本页 DOM 的当日判定前查跨天，跨天即整页刷新，防昨日已签误写为今日成功。
6. **前端独立呈现**：PTAutoCheckIn 用 Shadow DOM 注入 FAB/面板，样式隔离；关键提醒落页面 light DOM（用户注视处）。

## 设计模式

| 模式 | 用途 |
|------|------|
| 配置数据 + 引擎 | PTAutoCheckIn 站点/单元配置驱动 |
| 纯函数化解析 | `parseTorrentTable` 输入 DOM → 输出结构化对象（含 `_row` 元素引用），不直接操作 UI |
| 轮询/重试 | `setInterval` 有限重试（BilibiliEnterFullscreen 50×200ms、BTSchoolHelper 10×500ms）、`waitForElement` + 超时（PTAutoCheckIn） |
| 防误触守卫 | 键盘处理先查 `document.activeElement` 是否在 `input`/`textarea`/`select` |
| 步骤数组执行 | 复杂页面交互拆成步骤数组按序执行，允许单步 `ignoreError`（HDBao/蜂巢/菜单展开） |
| 载体无关信号 | `.26` 起按钮状态判定抽象为 `stateSignals`/`readEntryState`（text/attr/class/fn/exists），旧文本站自动翻译 |
| 常驻调度 + 后台标签 | 批量签到 = 发起页常驻 + `GM_openInTab` 后台标签串行 + 轮询 GM 状态推进 + 单站超时自动跳过 |

## 组件关系（PTAutoCheckIn 为例）

```text
boot() → main()
├─ 清理 stale 批量任务
├─ URL 带 ptacTask（后台任务标签）→ runBatchTabPage（只写状态不渲染）
└─ 普通访问（含落地页）
   ├─ 任务心跳新鲜 + 命中当前 unit → settleUnitOnLandingPage
   ├─ 心跳过期 → offerBatchResume 横幅
   └─ 无任务 → 被动 runUnit（25s 超时保护）
发起页 runBatchScheduler: GM_openInTab 后台标签 → 轮询 GM 状态(1s) → pending 观察 10s / 50s 超时跳过 → 站间缓冲
```

## 各脚本数据流要点

- **PTAutoCheckIn**：站点表 `SITES` → 拍平 `UNITS[]`（带 groupId/groupName）→ 单 unit 判定优先级（当日成功/已签检测/上次 pending/冷却/steps）→ 写 GM 状态。
- **BTSchoolHelper**：`parseTorrentTable('table.torrents')` → `TorrentState` 映射 → 高亮/低亮/滚动/键盘。
- **BilibiliEnterFullscreen**：`window.onload` + 轮询点击「网页全屏」，Enter/Shift+Enter 键盘监听。
- **EnhanceVisitedLinks**：`GM_addStyle` 注入 `:visited` 样式 + MutationObserver/interval 检测 URL 变化重注入。

## 健壮性约定（详见 conventions.md）

- 解析文本先 `trim`；数字走 `parseCommaIntSafe` / `parseCommaNumberSafe`；文件大小走 `parseFileSizeInBytes` 得数值字节。
- DOM 查询在可预期失败路径做空值兜底，不抛错中断整行解析。
- 时间尽量同时保留 `absolute`（Date/title）与 `relativeStr`（页面显示文本）。