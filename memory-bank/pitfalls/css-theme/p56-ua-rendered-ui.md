# UA 渲染的界面（滚动条 / 下拉弹层 / 自动填充 / 选中文字）不在任何扫描的视野里
> 摘要: UA 渲染的界面（滚动条 / 下拉弹层 / 自动填充 / 选中文字）不是 DOM 元素，走 `querySelectorAll` 的四档扫描永远测不出，只能靠「源码里有这几条」兜。
> 触发: UA 界面, color-scheme dark, autofill, ::selection, scrollbar 几何, 反断言

- **触发**: 都是「用的时候才发现」：滚动条是浅色的；`<select>` 展开的列表是白的；填过的输入框被 Chrome 刷成浅黄底；选中文字的高亮色刺眼；placeholder 灰得看不清；登录页的密码框仍是白底（主题只写了 `input[type=text]`）。
- **判别**: 前几轮加的四档扫描（漏白 / 小件近白 / 残留装饰 / 对比度）全都走 `document.querySelectorAll`，只覆盖 DOM 元素；滚动条、下拉弹层、自动填充背景、`::selection` 是浏览器画的，不是元素，扫描永远看不见，只能靠「源码里有这几条」来兜。
- **处置**: `.18` 修法：① `html[data-hdui-theme]{color-scheme:dark;}` 是主力，浏览器会自己把滚动条、下拉弹层、日期选择这些 UA 界面画成深色，零几何改动；② 自动填充 `input:-webkit-autofill` 的浅黄底改不了 `background-color`（优先级高于普通声明），只能用 `-webkit-box-shadow: 0 0 0 1000px var(--hdui-bg) inset` 盖掉并配 `-webkit-text-fill-color`；③ `::selection` / `::placeholder` / `:focus-visible` 各给主题色；④ 输入框选择器要覆盖 `password` / `number` / `email` / `url` / `search` / `tel`，别只写 `type=text`；⚠️ 不要自己写 `::-webkit-scrollbar{width:...}`（实测把默认 15px 压成 10px ⇒ 内容区宽 5px ⇒ 站点固定宽布局跟着长 5px ⇒ 文档宽 1247 → 1252，`sim-hdui-layout-width` 的「不撑宽页面」直接红；且任何 `::-webkit-scrollbar-*` 规则都会让 Chrome 从 overlay 切回 classic 滚动条，同样是几何改动），结论主题不该改 UA 的几何、只该改它的颜色（着色交给 `color-scheme`），已加反断言「源码不得出现 `html[data-hdui-theme] ::-webkit-scrollbar` 规则」防回退；⚠️ 反断言的匹配要带规则前缀（只搜 `::-webkit-scrollbar{` 会被源码注释里「不要写 ::-webkit-scrollbar{width...}」这句话自己命中）。

## P56. UA 渲染的界面（滚动条 / 下拉弹层 / 自动填充 / 选中文字）不在任何扫描的视野里

**症状**（都是"用的时候才发现"）：滚动条是浅色的；`<select>` 展开的列表是白的；
填过的输入框被 Chrome 刷成浅黄底；选中文字的高亮色刺眼；placeholder 灰得看不清；
登录页的密码框仍是白底（主题只写了 `input[type=text]`）。

**为什么测不出来**：前几轮加的四档扫描（漏白 / 小件近白 / 残留装饰 / 对比度）
**全都走 `document.querySelectorAll`** —— 只覆盖 DOM 元素。滚动条、下拉弹层、自动填充背景、
`::selection` 是**浏览器画的**，不是元素，扫描永远看不见，只能靠"源码里有这几条"来兜。

**修法（`.18`）**：
1. `html[data-hdui-theme]{color-scheme:dark;}` —— **这一条是主力**：浏览器会自己把滚动条、
   下拉弹层、日期选择这些 UA 界面画成深色。零几何改动。
2. 自动填充：`input:-webkit-autofill` 的浅黄底**改不了 `background-color`**（优先级高于普通声明），
   只能用 `-webkit-box-shadow: 0 0 0 1000px var(--hdui-bg) inset` 盖掉，并配 `-webkit-text-fill-color`。
3. `::selection` / `::placeholder` / `:focus-visible` 各给主题色。
4. 输入框选择器要覆盖 `password` / `number` / `email` / `url` / `search` / `tel`，别只写 `type=text`。

**⚠️ 不要自己写 `::-webkit-scrollbar{width:...}`**（实测踩过）：
- 把默认 15px 压成 10px ⇒ 内容区宽 5px ⇒ 站点那套固定宽布局跟着长 5px ⇒
  文档宽 **1247 → 1252**，`sim-hdui-layout-width` 的「不撑宽页面」直接红。
- 而且**任何** `::-webkit-scrollbar-*` 规则都会让 Chrome 从 overlay 切回 classic 滚动条，同样是几何改动。
- 结论：**主题不该改 UA 的几何，只该改它的颜色** —— 着色交给 `color-scheme`。
  已加反断言「源码不得出现 `'html[data-hdui-theme] ::-webkit-scrollbar` 规则」防回退。

**⚠️ 反断言的匹配要带规则前缀**：只搜 `::-webkit-scrollbar{` 会被源码注释里
"不要写 ::-webkit-scrollbar{width...}"这句话**自己命中**（刚踩过）。要搜 `'html[data-hdui-theme] ::-webkit-scrollbar`。


