# PTAutoCheckIn.user.js — PT 多站点自动签到

> 源文件：`src/PTAutoCheckIn.user.js` ｜ 版本 `2026.08.30.1`（升级时同步更新）

## 功能概述

访问匹配站点时**自动完成每日签到**，覆盖 18 个 PT 站 + 百度贴吧。以「站点配置数据 + 通用执行引擎」为设计核心：新增站点只需在 `SITES` 数组追加配置对象，无需改动引擎。

## 脚本元数据要点

- `@run-at document-start`：尽早运行，避免错过动态加载的签到按钮。
- `@grant GM_getValue / GM_setValue / GM_log`：用于跨页面记录上次激活时间（防重复签到）。
- `@match` 覆盖全部目标域名（见源码头部列表）。
- 若页面在 iframe 中（`window.top !== window.self`）直接退出。

## 架构与核心常量

### `MIN_INTERVAL` = 10 分钟
脚本启动时先执行 `waitForFromLastActivation(MIN_INTERVAL)`：
1. 读取 `GM_getValue('lastActivation_' + origin+pathname)`（按「协议+域名+路径」隔离记录）。
2. 若距上次激活不足 10 分钟，则 sleep 到满 10 分钟。
3. 无论是否等待都写入当前时间。

> 作用：用户在站内频繁刷新/跳转时，避免重复触发签到；也是"签到失败后过一会儿再试"的机制。

### `CLICK_CHECK_IN` 通用步骤
```js
{ type: 'click_checkin', description: '点击"签到"按钮', timeout: 5000 }
```
- 依赖站点级字段 `checkInSelector`（按钮定位）、`checkInContent`（按钮应含文案，不匹配则跳过）、`alreadyCheckedInContent`（检测已签到文案，命中即跳过）。

### `SITES` 站点配置数组

每个站点一个对象，字段如下：

| 字段 | 说明 |
|------|------|
| `name` | 站点中文名（仅用于日志） |
| `match` | `RegExp`，测试 `location.href` |
| `checkInSelector` | CSS 选择器定位签到入口（`click_checkin` 步骤用） |
| `checkInContent` | 期望按钮文本内容（可选，做二次校验） |
| `alreadyCheckedInContent` | 已签到特征文本（可选，命中则不再点击） |
| `steps` | 步骤数组，按序执行（见下） |

### 步骤类型（执行引擎 `executeStep`）

| type | 字段 | 行为 |
|------|------|------|
| `click_checkin` | 使用站点级字段 | 等待元素 → 已签到检测 → 文案匹配 → `el.click()` |
| `click` | `selector`（可传 CSS 字符串或**函数**）、`ignoreError` | 等待元素 → 点击 |
| `wait` | `ms` | 延时等待 |
| `check` | `selector` | 等待元素出现即通过（失败仅 warn） |
| `function` | `func` | 执行自定义异步函数 |

- 站点步骤中的单个步骤失败时：若 `step.ignoreError === true` 则忽略继续，否则中断整个站点流程并记为失败。
- `click_checkin`/`click` 步骤等待元素**超时**会 reject（`waitForElement` 内建 5s 默认超时），此时同样遵循 `ignoreError` 逻辑。

### `waitForElement(selector, timeout)`
- 支持函数选择器（每次检查时调用返回元素或 null）与字符串选择器。
- 先同步检查一次；未命中则 `MutationObserver` 监听 `document.body` 子树，命中即 resolve 并 `disconnect`。
- 超时 reject 并给出包含 selector 的中文错误信息。

## 已有站点一览（18 PT + 1 贴吧）

| name | 域名 | 入口选择器 | 签到文案 / 已签到特征 | 特殊步骤 |
|------|------|-----------|----------------------|----------|
| 躺平 | tangpt.top | `a.faqlink[href="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTTime | pttime.org | `a.fcb[href*="attendance.php"]` | `签到领魔力` / `签到详情` | — |
| Railgun | bilibili.download | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTZone | ptzone.xyz | `a.faqlink[href*="attendance.php"]` | `[簽到得魔力]`(繁体) / `簽到已得` | — |
| PTSBao | ptsbao.club | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDClone | pt.hdclone.top | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| BTSchool | pt.btschool.club | `a[href*="index.php?action=addbonus"] > font` | `每日签到` / `签到已得` | — |
| 大香蕉 | pt.daxiangjiao.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| NovaHD | pt.novahd.top | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| PTFans | ptfans.cc | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| CarPT | carpt.net | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDTime | hdtime.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| HDFans(红豆饭) | hdfans.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| CrabPT(蟹黄堡) | crabpt.vip | `a.faqlink[href*="attendance.php"]` | `[签到得蟹币]` / `签到已得` | — |
| Cyanbug(大青虫) | cyanbug.net | `a.nav-btn[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | — |
| 百度贴吧 | tieba.baidu.com | `.button-wrapper.operate-btn.follow-sign` | ` 签到 ` / `连签` | — |
| HDBao | hdbao.cc | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 点击会跳页：先点「立即签到」提交 → 等 2s → 再点签到 |
| MuXueGe(慕雪阁) | pt.muxuege.org | `a.faqlink[href*="attendance.php"]` | `[签到得魔力]` / `签到已得` | 同上（新站点，注意验证） |
| 蜂巢 | pting.club | — | — | 对话框签到：等 5s → 外层签到按钮 → 等 1s → 对话框签到按钮 → 等 1s → 关闭 |

### 复杂站点步骤细节

- **HDBao / MuXueGe**（跳页式）：三步 `steps`：
  1. `click`：`input[type="submit"][value="立即签到"][class="btn"]`（`ignoreError: true`）
  2. `wait` 2000ms
  3. `click_checkin`（`ignoreError: true`）
- **蜂巢**（对话框式）：不使用站点级 `checkInSelector`，全部用内联 `steps`：
  1. `wait` 5000ms（站点限制，实测 3s 不够）
  2. `click`（函数选择器）：遍历 `button:has(> svg):not([title])`，取文本含「签到」且不含「已」且长度 < 4 的按钮
  3. `wait` 1000ms
  4. `click`（函数选择器）：遍历 `span > button[data-slot="button"][type="button"]:not([title])`，找对话框「签到」按钮
  5. `wait` 1000ms
  6. `click`（函数选择器）：遍历 `div > button[data-slot="dialog-close"][type="button"]:not([title])`，找「关闭」按钮

## 主流程

```
main()
└─ waitForFromLastActivation(MIN_INTERVAL)
   └─ autoCheckin()
      ├─ 遍历 SITES，match 命中则 runSiteCheckin(site)
      └─ 全部未命中 → warn「未匹配到任何站点规则」
```

`runSiteCheckin` 依序执行 `steps`，任一非 `ignoreError` 步骤失败即 catch 并记为失败；全部通过记「签到完成」。

## 修改与扩展指南

1. **新增简单站点**：在 `SITES` 数组添加对象（name/match/checkInSelector/checkInContent/alreadyCheckedInContent/steps=[CLICK_CHECK_IN]），并在 `@match` 增加域名。
2. **新增交互复杂站点**：参考 HDBao（跳页）或蜂巢（对话框）模式编写 `steps`，优先尝试「通用点击」再逐步补充等待。
3. **站点失效排查顺序**：
   - 检查 console：是否 `未匹配到任何站点规则` → `match` 正则问题；
   - `未找到签到按钮… (已签到?)` → 选择器失效或文案变化，更新 `checkInSelector`；
   - `签到按钮内容不匹配` → 更新 `checkInContent`；
   - `等待元素 … 超时` → 页面结构/时序变化，调整步骤与 timeout。
4. **改动后**：递增版本号；到该站点页面刷新两次验证：第一次应触发签到，第二次（10 分钟内）应只等待不重复点击。
