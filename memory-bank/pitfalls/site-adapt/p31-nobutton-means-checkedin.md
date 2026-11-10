# 「已签后签到入口消失」别一律套 `noButtonMeansCheckedIn`: 先找页面上留下的已签文本
> 摘要: 「已签后入口消失」别一律套 `noButtonMeansCheckedIn`，先用 `alreadyCheck` 把「入口消失」升级为「入口消失且已登录」。
> 触发: 接入入口消失型站, 排查批量漏签, 配 alreadyPageCheck

- **触发**: 新站已签后签到按钮不见了（用户反馈「不再是按钮，变成 `魔力值 …(签到已得10)`」）→ 照抄 BTSchool 配 `noButtonMeansCheckedIn: true`。
- **判别**: 在**本来就没有签到入口**的页面（种子详情、设置、登录页、论坛）上「找不到按钮」被判成已签 → 当日写 success → **批量不再签、当天漏签**，且面板显示"已成功"，用户毫无察觉（比误报失败严重得多）；`noButtonMeansCheckedIn` 的语义是「找不到按钮 = 已签」，它成立的**前提**是该站签到入口**全站常驻**（每个页面都有、且只因已签而消失），未实测这个前提就启用，等于把"页面类型不对"当成了"已签"；更根本的结构性盲区: 它只回答了「入口没了？」，回答不了「**你登录了吗？**」——未登录(cookie 过期)/维护页/被封页面同样没有签到入口 → **把漏登录报成"今日已成功"**。
- **处置**: 先区分两种形态再选通道: **入口消失但页面留有已签文本**（HDHome「(签到已得N)」、HDBao/MuXueGe 落地页）→ 配 `alreadyCheckedInContent` + **`alreadyPageCheck: true`**（整页文本通道），**不开** `noButtonMeansCheckedIn`；**入口消失且无任何文本痕迹**（BTSchool）→ 才用 `noButtonMeansCheckedIn: true`，且必须先确认入口在该站**所有会被访问到的页面**上都存在。定稿(HDHome 2026.09.19): 用 `alreadyCheck` 把两件事一起问（同步判定，声明 `alreadyCheckBudgetMs: 0`）——入口还在 → false(未签)、入口消失 + 登录态专属元素(顶部魔力值信息栏)存在 → 已签、未登录页两个条件都不满足 → 落到 `unconfirmed`（可重试、**不计入失败**），不会假成功。**坑**: `alreadyCheckBudgetMs` 必须写在 `alreadyCheck` **8 行以内**（`check-ptac-budget.js` C2 的扫描窗口），函数体写太长会被判"未声明成本"（HDHome 初次提交就踩了）。

## P31. 「已签后签到入口消失」别一律套 `noButtonMeansCheckedIn`: 先找页面上留下的已签文本

**症状**：新站已签后签到按钮不见了（用户反馈「不再是按钮，变成 `魔力值 …(签到已得10)`」）→
照抄 BTSchool 配 `noButtonMeansCheckedIn: true` → 在**本来就没有签到入口**的页面（种子详情、
设置、登录页、论坛）上「找不到按钮」被判成已签 → 当日写 success → **批量不再签、当天漏签**，
且面板显示"已成功"，用户毫无察觉（比误报失败严重得多）。
**原因**：`noButtonMeansCheckedIn` 的语义是「找不到按钮 = 已签」，它成立的**前提**是该站签到入口
**全站常驻**（每个页面都有、且只因已签而消失）。未实测这个前提就启用，等于把"页面类型不对"
当成了"已签"。
**正确做法**：先区分两种形态，再选通道——
- **入口消失但页面留有已签文本**（HDHome「(签到已得N)」、HDBao/MuXueGe 落地页）→ 配
  `alreadyCheckedInContent` + **`alreadyPageCheck: true`**（整页文本通道），**不开** `noButtonMeansCheckedIn`。
- **入口消失且无任何文本痕迹**（BTSchool）→ 才用 `noButtonMeansCheckedIn: true`，且必须先确认
  入口在该站**所有会被访问到的页面**上都存在。
### 更进一步：`noButtonMeansCheckedIn` 即便前提成立也"不够保险"（HDHome 2026.09.19 的最终形态）

即便「入口全站常驻」已实测确认（HDHome 由用户确认），`noButtonMeansCheckedIn` 仍有**结构性盲区**：
它只回答了「入口没了？」，回答不了「**你登录了吗？**」。未登录（cookie 过期）/维护页/被封页面
同样没有签到入口 → 被判成已签 → **把漏登录报成"今日已成功"** —— 面板绿着、当天根本没签，
是所有误报里最坏的一类（用户完全无感知，且当天不会再重试）。用户据此要求换更严的判定。
**定稿方案：用 `alreadyCheck` 把两件事一起问**（同步判定，声明 `alreadyCheckBudgetMs: 0`）：
```js
alreadyCheck: () => {                                              // 同步, 无需等待
    if (document.querySelector('a[href*="attendance.php"]')) return false;        // 入口还在 → 未签
    return !!document.querySelector('a[href*="mybonus.php"], font.color_bonus');  // 入口消失 + 登录态证据
}
```
登录态证据取**只在登录后出现**的元素（HDHome = 顶部魔力值信息栏），于是「未登录页」→ 两个条件
都不满足 → 落到 `unconfirmed`（可重试、**不计入失败**），不会假成功。
**与 `alreadyPageCheck` 互补**：`alreadyCheck` 覆盖「已签但文本没渲染/文案改版」，
整页文本覆盖「登录态证据选择器改版」；任一命中即已签，两者都不命中的极端情况最多是 `unconfirmed`。
**通用化**：任何"入口消失型"站点都可以套这个形状 —— 找**一个登录态专属元素**作为证据，
把「入口消失」升级为「入口消失 **且** 已登录」。BTSchool 若将来出现同类误报，同样可改此形状。
**坑**：`alreadyCheckBudgetMs` 必须写在 `alreadyCheck` **8 行以内**（`check-ptac-budget.js` C2 的
扫描窗口），函数体写太长会被判"未声明成本"（HDHome 初次提交就踩了）。
该取舍由仿真用例 `tests/ptautocheckin/sim-hdhome-pagetext.js` 锁定：第 3 条「入口消失+登录态 → 已签」
与第 4 条「未登录页（同样无入口）→ **不得**判已签」是一对，共同锁住口径。

