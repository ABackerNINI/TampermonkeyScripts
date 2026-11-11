# 「同一条列网格」必须片头与数据行**横向 padding 一致** —— 差 1px 就是整行错位
> 摘要: 「同一条列网格」必须片头与数据行横向 padding 一致 —— 差 1px 就是整行错位；片头与数据行是各自独立的 flex 行，不是 table-layout 的问题。
> 触发: 列网格, 横向 padding, 逐列对齐, flex 行, 防回退断言

- **触发**: .19 用户实拍「标题栏错位 / 标题栏没对齐」：12 列的列头全部比数据往左 10px，真站逐列量出来 `Δl=10`（每一列都差 10px，不是单列错位）。
- **判别**: 本主题把表格改成了 flex 布局 —— 片头 `H`：`padding:10px 0 9px`（左右 0），数据行 `R`：`padding:7px 10px`（左右 10px）；片头和数据行是各自独立的 flex 行，列宽由 flex 决定，横向 padding 不一致 ⇒ 两条行的内容起点差 10px，12 列一起错；这不是 table-layout 的问题，是两条 flex 行自己的内边距不等。
- **处置**: 片头改成 `padding:10px 10px 9px`，与数据行的 10px 对齐，实测 `Δl: 10 → 0`；可复用排查手法：真站整页逐列量「表头单元格.left - 数据单元格.left」，再看两个 `<tr>` 自身的 boundingRect —— 若 tr 一致但 cell 差 N 就是行的横向 padding 差 N，若 tr 本身就差 N 那是别的（比如 margin / 不同的 flex 容器）；本次先误以为是 `border-collapse` 或 `table-layout`（试了都不相关），量出 cell 差 10、tr 一致后才定位到 padding；防回退：`sim-hdui-film-fidelity` 加「片头与数据行逐列对齐（12 列左右边缘差 ≤ 2px）」断言并反向验证过改回 `padding:10px 0 9px` 会红（12 列全报 `dL:10`），`check-hdui-static` 加两条源码断言。

## P58. 「同一条列网格」必须片头与数据行**横向 padding 一致** —— 差 1px 就是整行错位

**症状**（.19 用户实拍「标题栏错位 / 标题栏没对齐」）：12 列的列头**全部**比数据往左 10px。
真站逐列量出来 `Δl=10`（每一列都差 10px，不是单列错位）。

**根因**：本主题把表格改成了 flex 布局 ——
- 片头 `H`：`padding:10px 0 9px`（左右 **0**）
- 数据行 `R`：`padding:7px 10px`（左右 **10px**）

片头和数据行是**各自独立的 flex 行**，列宽由 flex 决定；横向 padding 不一致 ⇒
两条行的**内容起点**差 10px，12 列一起错。这不是 table-layout 的问题，是**两条 flex 行自己的内边距不等**。

**修法**：片头改成 `padding:10px 10px 9px`，与数据行的 10px 对齐。实测 `Δl: 10 → 0`。

**排查手法（可复用）**：真站整页逐列量 `表头单元格.left - 数据单元格.left`，
再看两个 `<tr>` 自身的 boundingRect —— 若 **tr 一致但 cell 差 N**，就是行的横向 padding 差 N；
若 **tr 本身就差 N**，那是别的（比如 margin / 不同的 flex 容器）。
本次先误以为是 `border-collapse` 或 `table-layout`（试了都不相关），量出 cell 差 10、tr 一致后才定位到 padding。

**防回退**：`sim-hdui-film-fidelity` 加「片头与数据行逐列对齐（12 列左右边缘差 ≤ 2px）」断言，
并**反向验证过**改回 `padding:10px 0 9px` 会红（12 列全报 `dL:10`）；`check-hdui-static` 加两条源码断言。


