# 新增站点/脚本检查清单与站点适配
> 摘要: 新增 PT 站或独立脚本的检查清单, 以及 NexusPHP 各站签到交互差异与选择器
> 触发: 新增站点, 加吧, 新增脚本, 站点适配

## 7. 新增站点/脚本检查清单

新增 PTAutoCheckIn 站点（或贴吧加吧）：
- [ ] 在 `@match` 增加域名（贴吧加吧无需，同域多个吧时 `match` 用函数按参数区分）；
- [ ] `SITES` 增加配置：简单站加单站对象（`name` / `id` / `url` / `match` / `checkInSelector` / `checkInContent` / `alreadyCheckedInContent` / `steps`）；同站多入口加 group，入口列表加进该 group 的 `units`；
- [ ] **已签后签到入口消失的站，别一律套 `noButtonMeansCheckedIn`**（见 P31）：它只回答「入口没了？」不回答「登录了吗？」，未登录/cookie 过期页同样无入口 → 会把**漏登录报成"今日已成功"**（最坏的误报）。优先取 **① 整页已签文本**（`alreadyPageCheck: true`）；需要"入口消失"这条通道时，用 **② `alreadyCheck` 自定义判定把「入口消失」升级为「入口消失**且**有登录态证据」**（找一个只在登录后出现的元素），并声明 `alreadyCheckBudgetMs`（同步判定写 `0`，且必须在 `alreadyCheck` **8 行内**，否则 C2 报未声明）；只有页面**无任何**已签痕迹且已确认入口全站常驻（BTSchool）才直接用 `noButtonMeansCheckedIn: true`；
- [ ] 对照站点页面的真实 DOM（非网络截图）核对选择器与文案；
- [ ] 实测：未签到页能点、已签到页不重复点、10 分钟内刷新不重复触发、贴吧各吧独立触发；
- [ ] **若新增/修改了 `function` 步骤或自定义 `alreadyCheck`**：**必须**声明 `budgetMs`(步骤) / `alreadyCheckBudgetMs`(unit)，**纯同步 DOM 判定写 `0`**；并确认该站「检测 + 各步骤 + 固定预留 18000ms」未超 `UNIT_TOTAL_TIMEOUT`(40000ms)（超时预算不变式，见 P28）；
- [ ] 跑 `node tests/ptautocheckin/check-ptac-budget.js`（零依赖），必须全绿：常量不变式 + 状态阶梯结构 + 不透明成本声明 + `computeUnitBudget` 自测（等价于 `node tests/run-all.js` 跑该测试）；
- [ ] 递增版本号 + 更新 `memory-bank/scripts/PTAutoCheckIn.md` 站点表与「各 unit 实测预算」表。

新增独立脚本：
- [ ] 完整元数据头（见第 3 节）+ IIFE + `ScriptName`；
- [ ] 参照 `README.md` 脚本速查表补充登记；
- [ ] 创建 `memory-bank/scripts/<name>.md` 并在 `memory-bank/README.md` 索引登记；
- [ ] 递增 `@version` 并提交。

## 9. 站点适配注意（PT/表格解析类）

PT 站大多基于同一套开源代码（NexusPHP 系），但**各站模板与签到交互存在差异**：

- 通用签到入口多为 `a.faqlink[href*="attendance.php"]`，按钮文案如 `[签到得魔力]`。
- 部分站点点击签到会**跳转新页面**（HDBao、慕雪阁），需要多步骤：先点"立即签到"提交表单 → 等待 → 再在新页面点签到。
- 部分站点使用**对话框签到**（蜂巢 fengchao.chat, 原 pting.club），需依次点击外层按钮、对话框按钮、关闭按钮。
- BTSchool 站种子表格结构特殊（详见 `scripts/BTSchoolHelper.md`）。
- 完整站点表与各站入口/特征见 `scripts/PTAutoCheckIn.md`「已有站点一览」。
