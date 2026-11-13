# HDHomeUI 架构决策与种子表十二列契约
> 摘要: ## 1 纯样式层 + 运行时列映射架构决策, ## 2 种子表十二列契约(含 ### 2.1 未知结构一律卸妆)
> 触发: 查架构决策, 查种子表十二列契约, 查未知结构卸妆

## 1. 架构决策：纯样式层 + 运行时列映射

这是「换肤不能换掉功能」的核心保障。

| 方案 | 功能保持 | 误触风险 | 结论 |
|------|----------|----------|------|
| **A. 纯 CSS + 运行时生成的 `nth-child` 规则** | DOM 与站内事件处理器原封不动 | 脚本永不 click / submit / dispatch | **采用** |
| B. 解析表格后重建卡片 DOM | 需重绑 7 类交互，漏绑即功能缺失 | 重建节点可能挂错 href（RSS/登出/签到） | 否决 |

要点：

1. **列索引运行时探测**：读 `#torrenttable` 表头（文本 / `img` class / `#calcTHeadA*`），
   产出 `colMap`（类型→1、标题→2 …），再**据此动态生成 CSS**，而不是写死 1..12。
   站点加列 ⇒ 映射自动跟随；少列或改名 ⇒ 判为结构错误，走回退。
2. **对站内 DOM 的唯一改动**：`<html>` 上的 `data-hdui-theme` / `data-hdui-state` 状态属性、
   已校验行上的 `--hdui-cat`（类别色）与 `--hdui-ratio`（做种占比）自定义属性，卸载时全部清理。
   **绝不**：增删/移动/克隆**站内**节点、给站内元素挂事件、改 `href`、改文本。
   > 脚本**自建**的节点不算违反上条，它们是自持 UI 的一部分，同样在 `unload()` / `dismissAlert()` 中清理：
   > `<style id="hdui-css">`（主题样式）、`<style id="hdui-boot">`（document-start 铺的底色）、
   > `#hdui-alert`（结构错误横幅，挂在 `document.body` 上，故需可见）、`#hdui-root`（浮动开关宿主）。
3. **自持 UI 隔离**：浮动开关 + 面板放进 **closed shadow root**，事件 `stopPropagation`，
   不冒泡到站内 document 级监听（用例 `sim-hdui-danger-guard` 钉死）。

---

## 2. 种子表十二列契约（改版检测抓手）

| # | 列 | 表头识别 |
|---|---|---|
| 1 | 类型 | 文本「类型」 |
| 2 | 标题 | 文本「标题」 |
| 3 | 评论 | `img.comments` / title=评论数 |
| 4 | 存活 | `img.time` / title=存活时间 |
| 5 | 大小 | `img.size` / title=大小 |
| 6 | 种子数 | `img.seeders` |
| 7 | 下载数 | `img.leechers` |
| 8 | 完成数 | `img.snatched` |
| 9 | 进度 | 文本「进度」（`td[align=center]`，无 class） |
| 10 | A | `#calcTHeadA` |
| 11 | A/GB | `#calcTHeadAve` |
| 12 | 发布者 | 文本「发布者」 |

另有 **A 级锚点**：`table.mainouter`、`#nav_block`、`#info_block`、`ul#mainmenu`。

错误码：

| 码 | 触发 |
|---|---|
| `E_ANCHOR_MISSING` | A 级锚点缺失（横幅点名缺了哪个） |
| `E_COLUMN_UNKNOWN` | 12 列里有识别不出来的（横幅点名缺哪列） |
| `E_COLUMN_UNEXPECTED` | **出现了认不出的列**（站点加列）—— 主题没有它的槽位，一律不上妆（P69） |
| `E_ROW_UNKNOWN` | **出现了认不出的行**（带 `colspan` 的分组/公告行）—— 同上（P69） |
| `ROW_CELL_COUNT_MISMATCH` | 列都在，但数据行单元格数与表头不符（**逐行**比对，不是只看 `rows[1]`，见 P68） |
| `E_STRUCTURE_CHANGED` | 运行中（MutationObserver）发现结构被改坏 |
| `E_APPLY_FAILED` / `E_UNKNOWN_THEME` / `E_BOOT_FAILED` | 自身异常，一律落到 `Diag` |

### 2.1 未知结构一律卸妆（2026-09-20 用户裁决）

主题是「每列一个 `nth-child` 槽位」的排版 —— 站点**多一列**或**多一种行**，主题就无从知道该把它摆哪。
裁决：**不猜**。认不出来就整体回退原站界面（`E_COLUMN_UNEXPECTED` / `E_ROW_UNKNOWN`）。

- 为什么不照常上妆：硬上妆只有两种结果 —— 被摆到错误的槽位，或被 `overflow:hidden` 压成一坨，
  **两者都等于屏蔽未知元素**，与「对未知元素不默认屏蔽」直接冲突。
- 为什么不进等结构窗口：`STRUCT_CODES`（等 8 秒那个）只留给 `ROW_CELL_COUNT_MISMATCH`
  （那是「A / A·GB 还没补完」的**时序问题**）；未知列/未知行等也没有用，拖 8 秒只会让人以为脚本卡死。
- 检测实现：`detectColumns` 额外返回 `unknownCols`（表头里 `headerKey()` 返回空的列号）与
  `spanRow`（数据行里任一单元格 `colSpan > 1` 的行号）；两者都排在 `!d.map` / `d.reason` 判定**之前**。
- 剧本：`hdhome-ui-extracol` / `-grouprow` / `-grouprow-first` / `-laterow`。

详见 `pitfalls/_index.md` **P68 / P69**。

回退动作：卸掉全部 `hdui-*` 样式与自定义属性 → 写 `hdui.lastError` → `console.error` →
页面顶部**红色横幅**（含错误码 + 「重新尝试」「知道了」）→ 主题显示回落 `default`。

---

