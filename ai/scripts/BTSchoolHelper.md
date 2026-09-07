# BTSchoolHelper.user.js — BTSchool 种子列表助手

> 源文件：`src/BTSchoolHelper.user.js` ｜ 版本 `2026.08.09.1`（升级时同步更新）

## 功能概述

作用于 BTSchool 种子列表页（`torrents.php`），提供：

1. **高亮**非置顶的「免费&2x上传」(2xFree) 种子标题（红色）。
2. **低亮**置顶种子（行透明度 0.5），便于快速跳过。
3. 按 **空格键** 平滑滚动到第一个非置顶种子（跳过置顶区）。
4. 预留 N 键「跳到下一个 2xFree」逻辑（**暂未实装**，代码中注释保留）。

> 演进说明：本脚本由早期「自动下载小种子」脚本演进而来，保留了完整的种子表格解析器 `parseTorrentTable`（现用于获取行/状态信息）。解析器抽取自真实页面 HTML（样本见 `src/BTSchoolTorrentsTableSample.html`），其中的坑与修复必须保留。

## 脚本元数据要点

- `@match https://pt.btschool.club/torrents.php*`
- `@grant none`、`@run-at document-end`
- `ScriptName = 'BTSchool助手'`（日志前缀带 `[ ]`）

## 核心数据结构

### `TorrentState` 枚举（Object.freeze）

| 常量 | 值 | 含义 |
|------|----|------|
| `NORMAL` | `normal` | 普通 |
| `FREE` | `免费` | 免费 |
| `_2XUP` | `2x上传` | 2 倍上传 |
| `FREE_2XUP` | `免费&2x上传` | 免费 + 2 倍上传 |
| `_50PCT_DOWN` | `50%下载` | 下载半价 |
| `_50PCT_DOWN_2XUP` | `50%下载&2x上传` | 下载半价 + 2 倍上传 |
| `_30PCT_DOWN` | `30%下载` | 下载 3 折 |

配套映射表：
- `TorrentStateAltMap`：图片 `alt` 文案 → 状态（`Free`、`2X`、`2X Free`、`50%`、`2X 50%`、`30%`）
- `TorrentStateClassMap`：图片 **class** → 状态（`pro_free`、`pro_2xup`、`pro_free2up`、`pro_50pctdown`、`pro_50pctdown2up`、`pro_30pctdown`）。**实际代码用 class 映射**（`getTorrentStateFromRowCell` 读取 `img[class*="pro_"]`）。

### Torrent 对象（parseTorrentTable 每行产出）

```
{
  id, index,                    // 种子ID（来自 details.php?id=）、行序号
  category, categoryId, encode, // 类型列：分类名/cat=ID/encode
  title, titleFull, detailUrl, titleElement,  // 标题与元素引用
  sticky, hot, state, remainingTime,          // 置顶/热门/下载状态/免费剩余时间
  official, subtitle,           // 官方标签与副标题
  doubanScore, imdbScore,       // 豆瓣/IMDB（无则'无'）
  downloadButtonElement, downloadUrl, bookmarkId,  // 下载/收藏
  numComments,                  // 评论数
  releaseTime,                  // { absolute: Date, absoluteStr, relativeStr }
  size, sizeStr,                // 字节数 & 原始字符串（size 已是数值！）
  seeders, leechers, snatched,  // 做种/下载/完成数
  calcA, calcADisplay,          // 时魔（data-calc-a 属性值 + 显示文本）
  calcAve, calcAveDisplay,      // 时魔/GB
  publisher, _row               // 发布者 & 原始 <tr> 引用（滚动/样式用）
}
```

## 种子表格解析（易错点 — 必须遵守）

BTSchool 的种子列表 HTML 结构（对照 `BTSchoolTorrentsTableSample.html`）：

```html
<table class="torrents">
  <tbody>
    <tr>…表头…</tr>
    <tr>  <!-- 数据行：tr 本身没有 rowfollow 类！ -->
      <td class="rowfollow">类型…</td>
      <td class="rowfollow" width="100%">
        <table class="torrentname">  <!-- 标题列内嵌二级表格，含 3 个 td -->
          <td class="embedded">标题链接/状态图/剩余时间/官方/字幕…</td>
          <td class="embedded" width="50">豆瓣/IMDB…</td>
          <td class="embedded" width="20">下载/收藏…</td>
        </table>
      </td>
      <td class="rowfollow">评论数</td>  … 共 11 个直接子 td
    </tr>
  </tbody>
</table>
```

**历史踩坑与正确写法**：

1. ~~`table.querySelectorAll('tr.rowfollow')`~~ → 匹配不到行。
   ✅ `table.querySelectorAll('tbody > tr:has(> td.rowfollow)')`
   （`rowfollow` 类在 `<td>` 上，需用 `:has()` 反查 `<tr>`。）

2. ~~`row.querySelectorAll('td')`~~ → 深度搜索会扫到嵌套表格里 3 个 `td`，共 14 个而非 11 个，后续列全部错位。
   ✅ `row.querySelectorAll(':scope > td')`（只取直接子单元格）。

3. 列索引约定（直接子 td）：`0` 类型 / `1` 标题 / `2` 评论 / `3` 存活时间 / `4` 大小 / `5` 做种 / `6` 下载 / `7` 完成 / `8` 时魔 / `9` 时魔/GB / `10` 发布者。行内解析均从标题列内**局部查找**（嵌套表格内），不依赖全局索引。

4. 标题列解析要点：
   - 标题链接：`a[href*="details.php?id="]`（`title` 属性为完整标题，文本可能折行）。
   - 置顶：`img[alt="Sticky"]`（早期用 class `top0`，现在以 alt 为准）。
   - 下载状态：取标题单元格内 `img[class*="pro_"]` 的 class 映射为 `TorrentState`。
   - 免费剩余时间：`getRemainingTimeByText` —— 用 TreeWalker 找含「剩余时间：」的文本节点，取其父内 `span[title]`，返回 `{absolute: Date, absoluteStr, relativeStr}`。
   - 官方：`span.label-primary`；副标题取其 nextSibling 文本，兜底取 `br` 后文本。
   - 评分：标题列内 `td.embedded[width="50"]` 的两个 `div`，剥离非数字后取值，空则 `'无'`。
   - 下载/收藏：`td.embedded[width="20"]` 内 `a[href*="download.php"]` 与 `a[id^="bookmark"]`。

5. 数值列解析：一律过 `parseCommaIntSafe(text, fallback)`（去掉千分位逗号再 `parseInt`）；时魔取 `td` 的 `data-calc-a` / `data-calc-ave` 属性（浮点，经 `parseCommaIntSafe` 处理）；大小列文本经 `parseFileSizeInBytes` 转字节，存 `t.size`（**数值**），原始字符串存 `t.sizeStr`。

## 工具函数

| 函数 | 说明 |
|------|------|
| `findTextNodeContaining(root, text)` | TreeWalker 按文本内容找文本节点 |
| `getRemainingTimeByText(node, textMarker)` | 见上，解析「剩余时间：」后 span 的绝对/相对时间 |
| `getReleaseTimeFromRowCell(timeCell)` | 解析存活时间列：`span[title]` 绝对时间 + 相对文本 |
| `getSizeFromRowCell(sizeCell)` | 解析大小列 → `{ sizeStr, size }`（字节） |
| `getTorrentStateFromRowCell(stateCell)` | 解析状态图 class → `TorrentState` |
| `parseCommaInt(str)` / `parseCommaIntSafe(str, fb)` | 千分位整数解析（NaN/兜底） |
| `parseCommaNumber(str)` / `parseCommaNumberSafe` | 千分位浮点解析 |
| `parseFileSizeInBytes(sizeStr)` | `"8.15GB"` → 字节数（1024 进制；支持 K/M/G/T/P 简写；异常抛错） |

## 页面行为函数

| 函数 | 行为 |
|------|------|
| `showTorrents(torrents)` | 调试用：打印统计/筛选/排序示例 |
| `arrayFind(array, predicate, fromIndex)` | 返回首个满足谓词的下标（-1 未找到） |
| `scrollToTorrent(torrent)` | `_row.scrollIntoView({behavior:'smooth', block:'center'})` |
| `getBottomElements()` | `document.elementsFromPoint(视口中央, 底部-50px)` 返回元素栈 |
| `getBottomTorrentID()` | 从视口底部最顶层元素向上冒泡，找含 `a[href*="details.php?id="]` 的节点 → 当前屏幕底部种子的 id（无则 null） |
| `scrollToFirstNonStickyTorrent` | 空格键目标：首个 `!sticky` 种子 |
| `scrollToFirst2xFreeTorrent` / `scrollToNext2xFreeTorrent` | 2xFree 跳转（后者依赖底部 ID 定位当前进度；当前仅 First 版有接入调用） |
| `dimStickyTorrents` | 置顶行 `opacity = 0.5` |
| `highlight2xFreeTorrents` | 非置顶 2xFree 标题 `color = 'red'` |
| `handleKeyDown(event, torrents)` | 空格 → `scrollToFirstNonStickyTorrent`；N 键分支预留（注释未启用） |

## 主流程

```
main()
└─ setInterval(500ms) 最多 10 次:
   ├─ parseTorrentTable('table.torrents')
   └─ 解析到 >0 行 或 达 10 次 → clearInterval → doIt(torrents)
doIt: dimStickyTorrents + highlight2xFreeTorrents + 注册 keydown
```

- 重试机制应对页面加载慢/动态渲染；表格未就绪时每次间隔 500ms 重试，最多 10 次。

## 已知问题 / 待办（勿在无关改动中误删）

- `scrollToNext2xFreeTorrent` 内部调用了 `getBottomTorrentId()`（小写 d）与 `arrayFindIndex`，而实际定义的是 `getBottomTorrentID()`（大写 D）与 `arrayFind` —— 若启用 N 键跳转需先修正调用名。
- N 键跳转「暂未实装」（注释保留）。若未来启用需补全上述函数调用并接入 `handleKeyDown`。
- 键盘处理同时监听 `keyCode === 32` 与 `event.key === 'keyN'`（后者写法存疑，仅作占位）。

## 修改指南

- 若站点改版导致高亮失效：先在控制台确认 `parseTorrentTable` 是否解析出行；再核对上面「易错点」中的选择器与列索引约定，用 `src/BTSchoolTorrentsTableSample.html` 对照验证。
- 新增高亮/低亮规则：在 `doIt` 中追加形如 `dimStickyTorrents` 的遍历函数。
- 改动后递增 `@version`。
