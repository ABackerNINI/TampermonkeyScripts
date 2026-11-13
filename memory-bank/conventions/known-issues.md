# 已知问题与未修项（Known Issues）
> 摘要: 原句照搬 progress.md 的现存 Bug / 已完成待审核 / 已知问题 / 待办方向 / 发布注意, 作为已知问题单点
> 触发: 查未修 Bug, 排障已知问题, 看待办方向, 查发布注意

来源：`progress.md`（已删，git 历史可考；D8 不新建 issue）

## 待办 / 待修（Known Bugs & Left to Build）

### 现存 Bug（优先）
- **P2 BTSchoolHelper 时魔数值恒为 0**：`calcA`/`calcAve` 误用 `parseCommaIntSafe` 解析浮点 `data-calc-a`/`data-calc-ave` → 需改 `parseCommaNumberSafe`。若排序/筛选依赖该值会导致结果失真。
- **P10 BTSchoolHelper 命名不一致**：`scrollToNext2xFreeTorrent` 内调 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，实际定义是 `getBottomTorrentID()`（大写 D）与 `arrayFind`。当前未启用不报错；启用 N 键前必须先改名对齐。

### 已完成（2026-09-20，待审核）：HDHomeUI「未知元素不默认屏蔽」专项 + 测试基建

- **5 个新用例**：`check-hdui-hide-allowlist.js`（静态隐藏白名单）/ `sim-hdui-hide-allowlist.js`（运行时 CSSOM 版）
  / `sim-hdui-unknown-canary.js`（金丝雀）/ `sim-hdui-overlay-safety.js`（浮层专项）/ `sim-hdui-unknown-tags.js`（未知列行 + 标签）。
  既有 12 个 hdui 用例全是**正向断言**，这 5 个补的是反向（deny-by-default）：「站点改版冒出来的东西还在不在」。
- **共享基建 `tests/lib/hdui-scan.js`**：五档渲染扫描（漏白 / 小件近白 / 残留装饰 / 对比度 / UA 界面）+ 金丝雀探针
  `canaries(page, ids)`。从 gitignore 的 `_verify-hdui-real-render.js` 提升入库 —— 不入库就永远无法回归。
- **生产修复 3 处真 Bug**：`table.torrents{color:#000}` 未重置（种子表里新元素继承纯黑 = 隐形）、
  促销徽章无兜底（未登记 `pro_*` 变 16×16 空白）、inline 白底兜底漏 6 位 `#ffffff`（公告块）。
- **结构裁决落地**：未知列 `E_COLUMN_UNEXPECTED` / 未知分组行 `E_ROW_UNKNOWN` ⇒ 一律卸妆、不进等窗口；
  行结构由「只查 `rows[1]`」改为**逐行**校验。
- 测试数 **29 → 34**，全绿。详见 `pitfalls/_index.md` P66–P69、`scripts/HDHomeUI.md` §2.1。

### 已知问题（2026-09-20 记录，尚未定位）

- **本地全量偶发 1 个用例红，且每次红的用例不同**（`sim-security-s04` / `sim-hdui-hide-allowlist` 都出现过）。
  单独重跑必过；**CI 连续 4 个提交全绿**（Node 20 + Node 22）。倾向本机负载（IDE + 35 个用例各起一次 Chrome）。
  已做的排查与加固：① S03/S04 的"固定 sleep 读存储"改成轮询完成信号（P73）；
  ② `harness.close()` 改成杀 Chrome 进程树（Windows 子进程会变孤儿）—— 实测进程数没有增长，属防御性加固。
  ⇒ 未定位。下次再遇到请**先取完整输出**（`node tests/run-all.js > log`）再看 `FAIL` 块，别只看摘要行。
- **S04 覆盖率有限**（P72）：`javascript:`/`data:` 的 favicon 过滤**无法被端到端证伪** ——
  同站约束 `isSameSiteHost()` 也会挡下来。S04 只能抓"两道一起被删"。已写进该文件头注释。

### 待办方向（详见 tasks/_index.md）
- **近期**：**PTAutoCheckIn 慢站修复实测校准（TASK015 / 校准项 21，8 项）**——改动已提交（`ebb06bb`），须先在真实站点验证，有问题再迭代；**补测试用例（TASK016）**——`tests/` 约定与运行器已就位，待补场景矩阵/解析器回归/元数据一致性；PTAutoCheckIn 既有逐站实测校准（校准项 1–20）；签到站点覆盖扩展；BTSchoolHelper 快捷键增强（N/B 键 + 行高亮）；BilibiliEnterFullscreen MutationObserver 加固。
- **中期**：设置面板化；解析工具函数收敛；表格解析回归测试；发布自动化（版本号校验）。
- **远期**：多站点种子聚合/搜索辅助；签到结果推送（GM_notification/Server 酱）；规则热更新（远端 JSON + 缓存）；代码现代化评审。

## 已知问题（见 pitfalls/_index.md 完整清单）

- P2、P10：上述现存 Bug。
- P16 起：PTAutoCheckIn v2 站点建模的各类已踩坑（落地页无反馈、confirmManual 卡 pending、跨天快照、验证码站、no-text 按钮、SPA 导航时序等）均已记录症状→原因→对策。

## 发布注意

- 任何代码/元数据改动必须同步递增 `@version` 并与代码同次提交；同步更新 `memory-bank/` 记忆库（见 conventions/ 第 0.4 / 1 节）。