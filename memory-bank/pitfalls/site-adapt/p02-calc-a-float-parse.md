# BTSchoolHelper 时魔字段：整数字符串解析吞掉浮点属性值（现存 Bug）
> 摘要: 整数字符串解析函数吞掉浮点属性值，导致时魔字段恒为 0（现存 Bug）。
> 触发: 解析时魔字段, 改 BTSchoolHelper, 排查 calcA 恒 0

- **触发**: 第 246/251 行用 `parseCommaIntSafe(attr, 0)` 解析**浮点**属性 `data-calc-a="0.0005235113302643479"`。
- **判别**: `t.calcA`、`t.calcAve` 恒为 `0`，但单元格 `data-calc-a="0.0005235113302643479"` 明明有值；`parseCommaInt` 内部用 `/^-?\d+$/` 校验，含小数点 → NaN → 兜底 0。
- **处置**: 改用 `parseCommaNumberSafe(attr, 0)`（浮点解析）；修复同时更新 `memory-bank/scripts/BTSchoolHelper.md` 与 `@version`。⚠️ 若排序/筛选逻辑依赖时魔数值，此 Bug 会导致结果失真。

## P2. BTSchoolHelper 时魔字段：整数字符串解析吞掉浮点属性值（现存 Bug）

**症状**：`t.calcA`、`t.calcAve` 恒为 `0`，但单元格 `data-calc-a="0.0005235113302643479"` 明明有值。
**原因**：第 246/251 行用 `parseCommaIntSafe(attr, 0)` 解析**浮点**属性。`parseCommaInt` 内部用 `/^-?\d+$/` 校验，含小数点 → NaN → 兜底 0。
**正确做法**：改用 `parseCommaNumberSafe(attr, 0)`（浮点解析）。
> ⚠️ 若排序/筛选逻辑依赖时魔数值，此 Bug 会导致结果失真。修复同时更新 `memory-bank/scripts/BTSchoolHelper.md` 与 `@version`。

