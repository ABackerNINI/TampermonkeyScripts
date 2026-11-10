# 千分位数字解析的两种函数不可混用
> 摘要: `parseCommaInt` 与 `parseCommaNumber` 适用列不同，混用会解析出 NaN。
> 触发: 选千分位解析函数, 改数据库列, 排查 NaN

- **触发**: 给评论/做种/下载/完成数或 `data-calc-a` 等浮点属性选千分位解析函数。
- **判别**: `parseCommaInt`：只接受**纯整数**（`/^-?\d+$/`），带小数点/单位返回 NaN；`parseCommaNumber`：浮点可解析（去逗号后 `Number()`），带单位仍 NaN。
- **处置**: 数据库列（评论/做种/下载/完成数）用 Int 版；`data-calc-a` 等浮点属性、`data-calc-ave` 用 Number 版；规则：**拿不准就用 Number 版 + Safe 兜底**。

## P3. 千分位数字解析的两种函数不可混用

- `parseCommaInt`：只接受**纯整数**（`/^-?\d+$/`），带小数点/单位返回 NaN；
- `parseCommaNumber`：浮点可解析（去逗号后 `Number()`），带单位仍 NaN。
- 数据库列（评论/做种/下载/完成数）用 Int 版；`data-calc-a` 等浮点属性、`data-calc-ave` 用 Number 版。
- 规则：**拿不准就用 Number 版 + Safe 兜底**。

