# PTAutoCheckIn 站点扩展与历史改动
> 摘要: 2026-11-11 新增青蛙/拾刻两站（按钮文案翻转型）、主面板交互与 HDHome 站、TASK015/016/017 慢站修复与零依赖测试约定
> 触发: 查 PTAutoCheckIn 站点, 签到排障
> 最后活动: 2026-11-19 05:58

**PTAutoCheckIn（`src/PTAutoCheckIn.user.js`，当前 `2026.11.11.1`）——2026-11-11 新增站点 青蛙(qingwapt.com)/拾刻(ptskit.org)**（用户给两站已签前后 HTML，标准 NexusPHP 按钮文案翻转型：已签后入口仍在、文案变「[签到已得N, 补签卡: M]」→ `alreadyCheckedInContent` 按钮级检测直判，不走 `noButtonMeansCheckedIn`；无 function 步骤/自定义 alreadyCheck，预算 23000ms 达标；`check-ptac-budget` + 全量 37/37 绿，待真站实测=校准项 24）；2026-09-19 主面板交互调整（失焦自动关闭 + 签到按钮重现不弹主面板，用户当日需求，**已提交 `80e0f37`（分支 `dev`，尚未 push）**）；2026-09-19 新增 HDHome 站（已签后入口变纯文本 → 整页文本 + 「入口消失且已登录」自定义判定双通道），**已提交 `d63fe0c`（分支 `dev`，尚未 push）**；此前的慢站误判修复已实施，待实测校准**；同日又完成 TASK017（本地仿真站 + 安全审计），修了首装崩溃等 5 处（见 P29/P30）。v2 引擎与站点建模此前已完成（批量+FAB+贴吧多吧合并为单一生产脚本）。**2026-09-18** 针对用户报告「经常失败 / 网页加载慢一点就可能失败 / 结果反馈慢」，完成 TASK015 的实施：整流程超时定时器不再覆写已给出的结论、状态写入加单向阶梯、新增 `unconfirmed` 独立状态、点击后观察改事件驱动 + 有界复检、建立超时预算不变式与双校验（运行时自检 + 静态校验器）、进度心跳 + 死站提前跳过（见 P28）。同日把测试工具收进 **`tests/`** 并定下零依赖测试约定（TASK016，见 `tests/README.md`）。**三批改动已提交**（`ebb06bb`、`2b31377`、`e2d5f52`，分支 `dev`，未 push），待真实站点实测校准。

**R1(2026-11-17 02:53):** 移除断点续签: 删 offerBatchResume/横幅操作钮机制(bannerHasAction+showBanner 收缩), 心跳过期分支改 clearTask+被动签到, @version 2026.11.16.1, 测试与 6 份文档同步, 全量 36/37 绿(唯一红=已入池的真站样本过期)

**R2(2026-11-17 03:59):** 追加: Chrome HttpsUpgrades 拦离线真站验收根因排障与修复(verify 驱动+harness 补 disable-features), issue 26-11-17-0122 根因改道翻 Done, 新坑 pitfalls/tests/chrome-https-first-blocks-offline-verify, 全量 37/37 新基线切片

**R3(2026-11-17 05:17):** 主面板今日已成功站点归入「已签到」折叠组(组头可点展开, 默认折叠, 展开态仅页面内存), @version 2026.11.17.1, 全量绿(见 kb.baseline), 评审 2 轮 2 nit(修 1 忽略 1)

**R4(2026-11-19 03:07):** Railgun(bilibili.download)适配 2026.11.19 站点改版: 签到入口收进头像用户卡, 改 HHCLUB 式两步流程(mouseenter 展开 .nx-avatar-wrap 兜底加 .is-open + 点横幅), checkInContent 去方括号, @version 2026.11.19.1; 全量绿(见 kb.baseline), 评审 3 轮(代码 1 nit 忽略留痕; 文档 1 nit 修——p32 改引引擎真实超时文案; 轮3 零发现), 新坑 p32-hover-expand-card

**R5(2026-11-19 05:58):** Railgun 已签检测按真站样本校准: alreadyCheckedInContent 签到已得→今日已签到(真站已签横幅), 新增 landingCheckedInContent=签到成功(attendance.php 签到后 h2; 落地页 href 选择器首中是通知铃占位 href, 按钮文案通道在落地页失效), @version 2026.11.19.2; 全量绿(见 kb.baseline), 评审 3 轮(轮1 1 major sites.md 漏同步 + 1 nit p33 铃铛机制表述, 均修; 轮2/轮3 零发现), 新坑 p33-href-decoy-first-match, p32 注意节改写, 站点总表 Railgun 行同步; 伴生发现入池 26-11-19-0618(展开态不保证跨步骤保持, 点击步骤可能等超时, 未修)
