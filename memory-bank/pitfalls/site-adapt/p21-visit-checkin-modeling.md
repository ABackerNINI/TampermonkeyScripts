# "访问即签到"型站与"动态落地页特征"站的建模: 勿套用按钮/静态文本通道
> 摘要: MTeam 型(访问即签)与 HHCLUB 型(动态落地页特征)勿套按钮/静态文本通道。
> 触发: 接入非常规签到站, 配 successDetect, 配 alreadyCheck, 菜单展开型签到

- **触发**: MTeam 登录态访问主页 `/index` 即自动完成当日签到(页面无任何签到按钮可点可检); HHCLUB 签到入口藏在头像下拉菜单(先点 `img#user-avatar` 展开再点 `a[href*="attendance.php"]`), 落地页确认特征是**动态文本**(`#date-display` 内容为当月 `yyyy-mm`, 随日期变)。
- **判别**: 两类非常规签到形态直接套用标准配置会误判或无法确认；`landingCheckedInContent`(静态字符串 `includes`)配死某个年月会过期失效。
- **处置**: MTeam 型用显式 `match` 函数**只认签到主页路径**(host 精确 `kp.m-team.cc` + pathname `/index`)→ 详情页/其它子域不触发; **不配** `checkInSelector`/`alreadyCheckedInContent`; steps 仅 `wait` 等 SPA 渲染; 成功靠 `successDetect:[{type:'func', fn: async 轮询成功特征}]`(MTeam = antd 卡片标题「站点数据/站點數據」双文本防 locale, 16s 超时); HHCLUB 型用 `alreadyCheck` **自定义 async 函数**(第 1 通道, 被动/批量/落地结算三路径共用)先限定**仅落地页路径**(`/attendance\.php/i.test(location.pathname)`)再轮询 `#date-display` 含**动态算出的当月前缀**(`${y}-${m}` 与当前日期比对, 不写死年月), 超时返回 false；动态文本(日期/用户名/随机 token)一律走 `alreadyCheck` 函数, 静态稳定文本才用 `landingCheckedInContent`；菜单展开型 `click` 步骤的 selector 须指向**展开触发器**(avatar), 点完留出菜单动画时间(`wait 500ms`)再 `click_checkin`。

## P21. "访问即签到"型站与"动态落地页特征"站的建模: 勿套用按钮/静态文本通道

**症状/背景**(MTeam 与 HHCLUB, 2026-09-08 接入): 两类非常规签到形态直接套用标准配置会误判或无法确认:
- **MTeam 型(访问即签、无按钮)**: 登录态访问主页 `/index` 即自动完成当日签到, 页面无任何签到按钮可点可检; 若按常规站配 `checkInSelector`, 或把 match 放宽到全站, 会出问题。
- **HHCLUB 型(菜单展开 + 动态落地页)**: 签到入口藏在头像下拉菜单(先点 `img#user-avatar` 展开再点 `a[href*="attendance.php"]`); 落地页确认特征是**动态文本**(`#date-display` 内容为当月 `yyyy-mm`, 随日期变)——`landingCheckedInContent`(静态字符串 `includes`)配死某个年月会过期失效。
**曾考虑又否决的做法**: MTeam 型配假的签到按钮、或用"到达任意页即成功"; HHCLUB 型把 `landingCheckedInContent` 写成 `date-display` 或固定年月。
**正确做法**:
- **MTeam 型(无按钮)**: 显式 `match` 函数**只认签到主页路径**(host 精确 `kp.m-team.cc` + pathname `/index`)→ 详情页/其它子域不触发(否则浏览页会被当成签到动作、页面无卡片误报 failed 并污染当日状态); **不配** `checkInSelector`/`alreadyCheckedInContent`(无按钮可检可点); steps 仅 `wait` 等 SPA 渲染; 成功靠 `successDetect:[{type:'func', fn: async 轮询成功特征}]`(MTeam = antd 卡片标题「站点数据/站點數據」双文本防 locale, 16s 超时); 未登录被重定向登录页 → 无特征 → 自然 failed, 符合语义(需登录)。
- **HHCLUB 型(动态落地页特征)**: 用 `alreadyCheck` **自定义 async 函数**作为已签检测通道(它在 `detectAlreadyCheckedIn` 第 1 通道, 被动/批量/落地结算三路径共用): 函数内先限定**仅落地页路径**才判(`/attendance\.php/i.test(location.pathname)`, 防首页其它区域误报), 再轮询 `#date-display` 含**动态算出的当月前缀**(`${y}-${m}` 与当前日期比对, 不写死年月), 超时返回 false。
**注意**:
- `alreadyCheck` 是 async 判定成功与否的"落地已签确认"与 `landingCheckedInContent` 静态标记是两套思路——动态文本(日期/用户名/随机 token)一律走 `alreadyCheck` 函数, 静态稳定文本才用 `landingCheckedInContent`; 不要把动态内容硬编码进静态字段。
- 菜单展开型签到, `click` 步骤的 selector 须指向**展开触发器**(avatar), 点完留出菜单动画时间(`wait 500ms`)再 `click_checkin`; 若菜单是 hover 展开(非 click), 需改 mouseover 触发方式(待实测校准)。

