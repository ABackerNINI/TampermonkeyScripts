# 「显示不全」要做成通用扫描：文本截断（scrollW/H > clientW/H）
> 摘要: 「显示不全」要做成通用扫描：文本截断（scrollW/H > clientW/H）；`FILM_W` 列宽表片头与数据行共用同一套 flex-basis，列宽类问题只改这一处。
> 触发: 显示不全, 文本截断扫描, scrollWidth clientWidth, FILM_W, flex-basis

- **触发**: .20 用户实拍「下载进度显示不全」—— 按描述去改，但意识到这类问题只能等用户截图，于是加了「文本截断」扫描（真站整页）。
- **判别**: 扫描判据：凡是 `scrollWidth - clientWidth > 1` 或 `scrollHeight - clientHeight > 1` 的元素都报，排除 `text-overflow:ellipsis`（那是刻意省略，不算 bug），只报结构与几何值、不报文本；立刻抓到一处没注意到的：`<td class='colhead'>进度` 被裁 3px —— 列宽 40px，但列头内容是 `::before` 图标 15px + gap 5px + 文字「进度」~23px = 43px，数据行的「100% / 做种中」两行也挤。
- **处置**: 把 `FILM_W.progress` 40 → 48 解决；关键点 `FILM_W` 这张表是片头与数据行共用的同一套 `flex-basis`（`basis` 数组分别 push 到 H 和 R），改一个值两边同时变，所以列宽类问题只改这一处就够了，不要去分别调片头/数据行；判据小结（遇到「显示不全/对不齐」）：逐列量 `cell.left` 差 → 是列宽/padding 问题，量 `scrollWidth vs clientWidth` → 是容器太窄（内容被裁），两者都看（本次 padding 差 10px 与列宽少 3px 是两个独立问题，一次扫描各抓一个）。

## P61. 「显示不全」要做成通用扫描：文本截断（scrollW/H > clientW/H）

**起因**：.20 用户实拍「下载进度显示不全」—— 我按描述去改，但意识到**这类问题只能等用户截图**。
于是加了「文本截断」扫描（真站整页）：
凡是 `scrollWidth - clientWidth > 1` 或 `scrollHeight - clientHeight > 1` 的元素都报，
**排除** `text-overflow:ellipsis`（那是刻意省略，不算 bug）。只报结构与几何值，不报文本。

**立刻抓到一处我没注意到的**：`<td class="colhead">进度` 被裁 **3px** ——
列宽 40px，但列头内容是 `::before` 图标 15px + gap 5px + 文字「进度」~23px = **43px**。
数据行的"100% / 做种中"两行也挤。把 `FILM_W.progress` 40 → **48** 解决。

**关键点**：`FILM_W` 这张表是**片头与数据行共用**的同一套 `flex-basis`（见 `basis` 数组分别 push 到 H 和 R），
改一个值两边同时变 —— 所以列宽类问题**只改这一处**就够了，不要去分别调片头/数据行。

**判据小结（遇到"显示不全/对不齐"）**：
- 逐列量 `cell.left` 差 → 是列宽/padding 问题
- 量 `scrollWidth vs clientWidth` → 是容器太窄（内容被裁）
- 两者都看：本次 padding 差 10px 与列宽少 3px 是**两个独立问题**，一次扫描各抓一个。


