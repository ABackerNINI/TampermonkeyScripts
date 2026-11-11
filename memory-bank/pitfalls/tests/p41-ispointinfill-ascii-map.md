# 看不了图片时，用 `isPointInFill()` + ASCII 地图程序化校验图标
> 摘要: 图片读取不可用时，用 `isPointInFill()` + 栅格扫描 + ASCII 地图程序化校验图标轮廓，比肉眼更可靠。
> 触发: 图标校验, 看不了图片, isPointInFill, ASCII 地图, 栅格扫描

- **触发**: 会话中图片读取不可用（`current model does not support images`），无法用截图肉眼校验图形。
- **判别**: 需要纯程序化、可复现的图形校验手段，才能确认缺口位置、面积与是否多出异常杂形。
- **处置**: 用 `SVGGeometryElement.isPointInFill()` 在 headless Chrome 探针页里判定点是否在图形内；`step=0.25` 栅格扫描对比被咬掉面积及占比、缺口包围盒/中心，且「新图多出的面积」必须为 0（专抓 `evenodd` 越界杂形 P39 与坐标舍入伪影）；`step=0.4` ASCII 地图（`#` 两图都有 / `.` 被咬掉 / `X` 新图多出）不用图片也能「看见」轮廓。

## P41. 看不了图片时，用 `isPointInFill()` + ASCII 地图程序化校验图标

**症状**：会话中图片读取不可用（`current model does not support images`），无法用截图肉眼校验图形。
**对策**（纯程序化，且可复现，比肉眼更可靠）：
1. **`SVGGeometryElement.isPointInFill()`** —— headless Chrome 里直接判定点是否在图形内：
   建一个含 `<svg>` + 两个 `<path>`（原图 / 新图）的探针页，`--dump-dom` 取结果。
2. **栅格扫描对比**（`step=0.25` 扫 0..24 × 0..24），得到：
   - 被咬掉的面积 及 占原图百分比
   - 缺口包围盒 / 中心（确认位置对）
   - **"新图多出的面积"必须为 0** —— 这一项专门抓 `evenodd` 越界杂形（P39）和坐标舍入伪影
3. **ASCII 地图**（`step=0.4` 逐行输出）最有用，`#`=两图都有 / `.`=只原图有（被咬掉）/ `X`=只新图有（异常）
   —— **不用图片也能"看见"轮廓**。


