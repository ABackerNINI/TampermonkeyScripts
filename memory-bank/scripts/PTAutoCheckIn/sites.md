# 已有站点一览(30 站 + 贴吧 6 吧)·站点表
> 摘要: 30 个 PT 站与贴吧 6 吧的入口、特征与各 unit 预算配置总表
> 触发: 查站点配置, 加站点, 核对选择器与文案

## 已有站点一览(30 站 + 贴吧 6 吧)

> 2026.09.07 实测各站签到链接普遍不再带 `faqlink` class, 故所有 PT 站 `checkInSelector` 一律去掉 class 依赖(仅按 `href*="attendance.php"` 定位); PTTime 保留 `a.fcb`、Cyanbug 保留 `a.nav-btn`(非 faqlink, 实测仍有效)。站点 `url` 同步更新为当前有效入口(大多去掉 `www.` 前缀, 与 `match` 保持一致)。蜂巢为 shadcn/Radix 改版站(签到是按钮不是 attendance 链接), 例外按 `data-slot` 定位, 见下表。

| unit | 域名/kw | 入口选择器 | 签到文案 / 已签特征 | 备注 |
|------|---------|-----------|-------------------|------|
| 躺平 | tangpt.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTTime | pttime.org | `a.fcb[href*="attendance.php"]` | `签到领魔力` / `签到详情` | 落地页标记 `总签到记录`(见下) |
| Railgun | bilibili.download | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTZone | ptzone.xyz | `a[href*="attendance.php"]` | `[簽到得魔力]`(繁) / `簽到已得` | — |
| PTSBao | ptsbao.club | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDClone | pt.hdclone.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| BTSchool | pt.btschool.club | `a[href*="index.php?action=addbonus"] > font` | `每日签到` / `签到已得` | 已签后按钮消失; `noButtonMeansCheckedIn:true` |
| 大香蕉 | pt.daxiangjiao.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| NovaHD | pt.novahd.top | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTFans | ptfans.cc | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| CarPT | carpt.net | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDTime | hdtime.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDFans | hdfans.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDHome | hdhome.org | `a[href*="attendance.php"]` | `签到得魔力`(**无方括号**) / `签到已得`(已签后入口消失, 原地变纯文本) | `alreadyCheck`(入口消失**且**登录态证据) + `alreadyPageCheck:true`; **不用** `noButtonMeansCheckedIn`(见 P31) |
| CrabPT | crabpt.vip | `a[href*="attendance.php"]` | `[签到得蟹币]` / `签到已得` | — |
| Cyanbug | cyanbug.net | `a.nav-btn[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDBao | hdbao.cc | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 跳页; `attendanceUrl` 直达; `alreadyPageCheck:true` |
| MuXueGe | pt.muxuege.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同上 |
| 蜂巢 | fengchao.chat(原 pting.club, 旧域 @match 仍保留) | `button[data-slot="sidebar-user-check-in"]` | — / `已签到` | 对话框式(改版后已签检测启用, 对话框步骤可选); `successDetect` 按钮变已签 5s |
| MTeam | kp.m-team.cc | —(无按钮, 登录态访问主页 `/index` 即自动签到) | — / — | 显式 `match` 只认 kp 子域 `/index`; `successDetect` func 轮询 antd 卡片「站点数据/站點數據」(16s); 未登录被重定向无卡片 → failed |
| DigitalCore | digitalcore.club | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="/alltorrents"]`「All Torrents」 | 同 MTeam 隐式签到型: 显式 `match` 限首页(根或 `/index`, 排除详情/种子列表误触发); `successDetect` func 轮询该链接(16s); 未登录重定向无导航 → failed |
| HD-Space | hd-space.org | —(无按钮, 登录态访问首页即自动签到) | — / 整页文本「Last access:」 | 同 MTeam 隐式签到型: 显式 `match` 限首页根路径; `successDetect` text 轮询「Last access:」(16s); 未登录重定向无该文本 → failed |
| Kufirc | kufirc.com | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="/torrents.php"]`「Torrents」 | 同 DigitalCore/HD-Space 隐式签到型: 显式 `match` 限首页根路径; `successDetect` func 轮询该链接(16s); 未登录页显示 Login/Reactivate 无该链接 → failed |
| 凤凰PT | pt.521.best | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a[href="torrents.php"][rel="sub-menu"]`「种子」 | 同 MTeam 隐式签到型(NexusPHP 传统中文站): 显式 `match` 限首页(根或 `/index.php`); `successDetect` func 轮询该链接(16s, 相对路径无前导斜杠 + rel 属性); 未登录登录页无该链接 → failed |
| Sportz Bar | sportz247.bar | —(无按钮, 登录态访问首页即自动签到) | — / 导航链接 `a.level1-a.drop[href="#"]`「Torrent Menu」 | 同 MTeam 隐式签到型(xbtitFM 传统站): 显式 `match` 限首页(根或 `/index.php`); `successDetect` func 轮询该链接(16s, href 为 `#` 锚点 + level1-a drop class); 未登录无导航菜单 → failed |
| NodeLoc | nodeloc.com | `button.checkin-button`(no-text 图标钮, 点它签到) | —(按钮无可见文本) / class 含 `checked-in` + title/aria-label「您今天已经签到过了」 | Discourse 论坛: **no-text 按钮无文本 → 引擎文本通道不可用**, 已签判定走 `alreadyCheck` 自定义(class/title 属性), 点击走 function 步骤, 成功走 func `successDetect`(轮询 checked-in 16s); 显式 `match` 限首页根路径; 无 `checkInContent`/`alreadyCheckedInContent`, 但配 `checkInSelector` + `stateSignals`(class/attr 载体: checked=checked-in/含「已经签到过」, checkable=含「每日签到」)→ **P25 重现检测已纳入**(.26 通用化改造, 待实测) |
| HHCLUB | hhanclub.net | 先点 `img#user-avatar` 展开菜单, 再点 `a[href*="attendance.php"]` | `[签到得憨豆]` / 落地页 `#date-display` 当月 `yyyy-mm` | `alreadyCheck` 自定义函数(动态算当月); **头像点-验-重试函数步骤**(点击后验签到链接可见, 最多3次) + `successDetect` 同页确认(轮询变 attendance.php 且当月日历 8s)双通道; 2026.09.08 修复普通触发偶发失败 |
| U2 | u2.dmhy.org | `a[href*="showup.php"]` | `立即签到` / `已签到` | **仅检测型** `detectOnly:true`(签到需人工输入验证码 → 不自动点击/不进批量); 未签面板提示「需人工签到」; 按钮文案变已签即判 success(2026.09.08 接入, 待实测) |
| 青蛙 | qingwapt.com | `a[href*="attendance.php"]` | `[签到得蝌蚪]` / `签到已得` | 标准文案翻转站(2026.11.11 接入): 已签后入口**仍在**(class 变空), 文案变「[签到已得N, 补签卡: M]」 |
| 拾刻 | ptskit.org | `a[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同青蛙(2026.11.11 接入): 已签后入口仍在, 文案变「[签到已得N, 补签卡: M]」 |
| pt吧 | tieba f?kw=pt | `.button-wrapper.operate-btn.follow-sign` | `签到` / `连签` | `batchDelayMs:3000` |
| hdsky吧 | tieba f?kw=hdsky | 同上 | 同上 | 同上 |
| 饥荒吧 | tieba f?kw=饥荒 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |
| 战舰世界吧 | tieba f?kw=战舰世界 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |
| 深海迷航吧 | tieba f?kw=深海迷航 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |
| 缺氧吧 | tieba f?kw=缺氧 | 同上 | 同上 | 同上(2026.09.08 .27 接入, 待实测) |

> 步骤引擎(click_checkin/click/wait/check/function)自 v1 沿用; 通用步骤见旧版代码注释。
