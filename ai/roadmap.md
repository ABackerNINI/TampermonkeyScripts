# 路线图（Roadmap）

> 按优先级分「待修 Bug → 近期功能 → 中期改进 → 远期构想」。
> 每完成一项：勾选 + 在对应脚本文档/`@version` 中更新，并删除/降级本条目。
> ⚠️ **铁律**：任何代码/元数据改动必须**同步递增 `@version` 并与代码同次提交**（纯注释、仅改 `ai/` 文档除外）。详见 `conventions.md` 第 1 节。

## 🔴 待修 Bug（建议优先）

- [ ] **BTSchoolHelper 时魔数值恒为 0**（P2）
  - `calcA` / `calcAve` 误用 `parseCommaIntSafe` 解析浮点 `data-calc-a` / `data-calc-ave`。
  - 修复：改用 `parseCommaNumberSafe`；顺带确认显示逻辑与排序示例。
- [ ] **BTSchoolHelper 命名不一致**（P10）
  - `getBottomTorrentId()` → `getBottomTorrentID()`、`arrayFindIndex` → `arrayFind` 对齐后再启用 N 键。
- [ ] 若启用 **N 键「跳到下一个 2xFree 种子」**：补全 `scrollToNext2xFreeTorrent` 调用并接入 `handleKeyDown`（当前为占位注释）。

## 🟡 近期功能

- [ ] **PTAutoCheckIn v2 实测校准并并入正式版**
  - `src/PTAutoCheckIn-v2.user.js`(2026.09.07.9) 已实现: 被动+批量+贴吧多吧(unit 级独立冷却/状态)+FAB 面板(深浅色跟随系统, 跨站同数据, 站点图标显示, 点站点名新标签打开, 失败且冷却中的站特殊样式并默认排除批量, 可展开 `^` 用琥珀色「强制批量签到」按钮强制重试, match 字段已删/页面归属由 url 推导)+批量完成停发起页弹面板; 检测与冷却解耦(每次访问检测已签, 冷却只防重复点击); 批量=常驻发起页+后台标签串行调度(GM_openInTab, 轮询 GM 状态推进, 单站 50s 超时自动跳过吸收断链, 中断可横幅一键恢复)。
  - 待实测校准: 贴吧已签文案/签到成功文案、蜂巢改版后对话框是否仍存在(已签检测已按 data-slot 文案启用, 无成功特征仍 confirmManual)、BTSchool 无按钮即已签(noButtonMeansCheckedIn)、面板点站名打开/站点图标显示/`^` 展开强制批量签到、match 删除后 url 推导归属回归(含贴吧 kw 区分/批量后台标签/落地页结算)、HDBao/MuXueGe 落地页检测、15 个 PT 站回归(清单见 `scripts/PTAutoCheckIn.md`)。
  - 验证通过后: 合入 `PTAutoCheckIn.user.js`(改回 `@name`, 递增版本号), 删除 v1 旧文件。
- [ ] **签到站点覆盖扩展**
  - 按 `ai/conventions.md` 第 7 节清单继续补充新站（如遇新 PT 站、开放注册的站）。
  - 探索「同源多入口」（顶部按钮 + 侧栏按钮）冗余选择器，提高站点改版容错。
- [ ] **BTSchoolHelper 快捷键增强**
  - 空格行为已有；补充 `2xFree 下一个`（N）、`2xFree 上一个`（B）并支持循环边界提示（控制台日志）。
  - 键盘高亮当前选中种子行（视觉反馈），便于连续浏览。
- [ ] **BilibiliEnterFullscreen 适配加固**
  - 评估将自动网页全屏由 `window.onload + 轮询` 升级为 `MutationObserver` 监听播放器容器出现，减少无效点击日志。
  - 补充「倍速/画中画」相关键位冲突检查（Enter 在输入法组合中不应触发——已防 input，但 IME 候选框场景需再验）。

## 🟢 中期改进

- [ ] **设置面板化（GM 存储驱动）**
  - 提供统一设置（GM 菜单或注入面板）：
    - PTAutoCheckIn：签到总开关、单站开关、间隔时长；
    - BTSchoolHelper：高亮色、是否低亮置顶、是否自动滚动；
    - BilibiliEnterFullscreen：是否自动网页全屏。
  - 约定：设置项默认值与旧版行为一致，改动同步 `GM_setValue` 并立即生效。
- [ ] **解析工具函数收敛**
  - 将 `parseCommaInt(Safe)` / `parseCommaNumber(Safe)` / `parseFileSizeInBytes` / `waitForElement` 等重复代码抽取为共享片段说明或独立 `utils` 用户脚本（注：Tampermonkey 不支持跨文件 import，可考虑 `@require` 同一 raw 文件，需权衡更新耦合）。
- [ ] **表格解析回归测试**
  - 以 `BTSchoolTorrentsTableSample.html` 为基座，编写 Node/浏览器可跑的解析断言脚本（无框架，纯脚本比对字段），站点改版后可一键回归。
- [ ] **发布自动化**
  - 增加版本号校验脚本（读取 `@version` 与上次 tag 比对）或 Git 钩子，防止漏更版本。

## 🔵 远期构想

- [ ] **多站点种子聚合/搜索辅助**（新脚本方向）：跨 PT 站关键字检索并高亮同资源不同站点的体积/免费对比。
- [ ] **签到结果推送**：结合桌面通知（`GM_notification`）或 Server 酱等 Webhook，汇总当日各站签到结果。
- [ ] **规则热更新**：站点配置（SITES 数组）改为远端 JSON + 本地缓存（GM 存储），站点改版无需改脚本即可下发新选择器（注意安全：仅拉取固定 HTTPS 源并做格式校验）。
- [ ] **代码现代化评审**：逐脚本走查 `keyCode` → `event.key`、`var` 残留、`for...in` 等历史写法，统一现代风格（保持行为不变的分批提交）。

## 原则

1. **优先保证主路径可用**：站点失效时宁可跳过并打 warn，不阻塞用户浏览。
2. **每次改动 = 版本号 + 文档同步**：无文档不留痕。
3. **保守扩展**：个人脚本以稳定为先，新增能力默认关闭或可配置，避免未经请求改变用户浏览行为。
