# 37 —— PTAutoCheckIn Railgun 用户卡两步签到轮全量基线

> 摘要: PTAutoCheckIn Railgun 用户卡两步签到轮全量基线
> 基线时间: 2026-11-19 03:06

## 验收数字

- TOTAL: 37 · 通过: 37 · 失败: 0
- 汇总行(实测誊写): `✔ 全部 37 个测试通过。`
- 差值(vs 上一片 26-11-17-0523-ptautocheckin-sites): 0 变化 —— 本轮仅动 Railgun 站点配置(新增步骤 + 文案校准), 测试面无增删, 37/37 恒绿; 静态校验器 check-ptac-budget 对新 function 步骤的 budgetMs 声明照常过检(含在 37 内)。

## 本改动面

- `src/PTAutoCheckIn.user.js`: Railgun 站点适配 2026.11.19 改版 —— 签到入口从页面直挂 attendance 链接收进头像用户卡, 改 HHCLUB 式两步流程: 首步 `{type:'function'}`(budgetMs 8400, 点-验-重试最多 3 次)对 `.nx-avatar-wrap` 派发 `mouseenter`(站点 topbar.js 是 hover 展开加 `.is-open`, 头像按钮未注册 click; 兜底直接加 `.is-open`)后轮询横幅可见, 再 CLICK_CHECK_IN 点横幅; `checkInContent` `[签到得魔力]` → `签到得魔力`(新横幅无方括号); `alreadyCheckedInContent` 沿用 `签到已得`(已签态横幅无样本待真站校准); `@version` 2026.11.17.1 → 2026.11.19.1。
- 测试面无改动; 评审 3 轮(轮1 代码面 1 nit 忽略留痕——配置注释已如实标注已签态无样本; 轮2 文档面 1 nit 采纳修复——p32 症状改引引擎真实超时文案「已存在但不可交互/隐藏」; 轮3 零发现), 引文机检累计 2/2 过; 新坑 `pitfalls/site-adapt/p32-hover-expand-card.md`(hover 展开卡程序化 click 无效)。

