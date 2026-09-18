# tests/ —— 开发期测试与校验工具

> 本目录是 **TampermonkeyScripts** 的开发期测试区，**不属于生产脚本**（生产脚本只在 `src/*.user.js`）。
> 目标：让「给脚本加一条回归测试」成为**零配置、零依赖**的动作 —— 新增一个 `.js` 文件即可，无需改运行器、无需 `npm install`。

## 运行

```bash
node tests/run-all.js            # 跑 tests/ 下全部测试(只对失败项打印输出)
node tests/run-all.js -v         # 总是打印子进程输出
node tests/run-all.js --list     # 只列出发现的测试
node tests/check-ptac-budget.js  # 单独跑某一个(所有测试都能独立运行)
```

退出码：`0` 全通过 / `1` 有失败 / `2` 没发现测试或源文件缺失。可直接接 CI 或 git hook。

## 约定

| 位置 | 约定 |
|------|------|
| `tests/*.js`（顶层） | **每个文件 = 一个可独立运行的测试**，用**退出码**表达结果（0=通过，非 0=失败）。不需要任何测试框架。 |
| `tests/_*.js` | 下划线开头 = 临时/草稿，**不参与** `run-all.js`（排查问题时可随意留）。 |
| `tests/run-all.js` | 运行器自身，不参与。 |
| `tests/lib/` | 共享辅助代码（如「从 userscript 抽取函数」的 harness）。子目录内容**不会**被当作测试执行。 |
| `tests/fixtures/` | 测试数据（真实页面 HTML 样本等）。脱敏后再入库，勿含账号/会话信息。 |

**零依赖**：只用 Node 内置模块。本仓库刻意保持「无 `package.json` / 无 npm / 无构建」，测试不得引入任何 npm 包或框架。

## 三条纪律（`memory-bank/conventions.md` 第 8 节）

1. **鼓励为可测性设计**：逻辑尽量纯函数化、配置与逻辑分离、副作用收敛到 `main()`。
2. **禁止为测试留通道**：**不得**在生产代码里加 `if (window.__TEST__)`、把内部函数挂到 `window`、用 URL 参数开测试模式，或为断言方便加 DOM 标记。
3. **禁止为过测试改生产代码**：测试失败先查**测试自身**（断言/样本/环境），再查生产代码的真实缺陷；不得弱化断言、跳过分支、写死返回值来「变绿」。

> 违反第 2 条是最容易犯的错：想测一个函数，就把它 `window.xxx = fn` 暴露出去。正确做法见下一节。

## 如何测 userscript（核心技法）

生产脚本是**单文件 IIFE + 无 DOM 环境**，无法直接 `require`。本仓库验证过的做法是：
**把源文件里自包含的代码块切出来，写进临时模块再 `require`** —— 生产文件本身一行不改。

```js
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src', 'PTAutoCheckIn.user.js'), 'utf8');

// 1) 按注释标记切出自包含的一段(要求这段不闭包引用 IIFE 里的其它局部变量)
const a = src.indexOf('const AUDIT_RESERVE_MS');
const b = src.indexOf('// 全站预算审计');

// 2) 前置依赖也从源文件里抽(或读常量), 避免在测试里硬编码一份会漂移的副本
const prelude = [
    'const UNIT_TOTAL_TIMEOUT = 40000;',
    "const CLICK_CHECK_IN = { type: 'click_checkin', timeout: 5000 };"
].join('\n');

// 3) 写临时模块并 require —— module.exports 只出现在临时副本里, 生产文件保持干净
const tmp = path.join(os.tmpdir(), `ptac-${process.pid}.js`);
fs.writeFileSync(tmp, `${prelude}\n${src.slice(a, b)}\nmodule.exports = { computeUnitBudget };\n`);
const { computeUnitBudget } = require(tmp);
fs.unlinkSync(tmp);

// 4) 断言: 合法用例通过、非法用例被拒
```

要点与坑：

- **被切的代码块必须自包含**。若它闭包引用了 IIFE 里的其它局部变量，说明**生产代码该重构**（抽成不依赖闭包的纯函数 / 参数注入），而不是加测试后门 —— 这是 `conventions.md` §8.1 的正当理由。
- **临时文件放 `os.tmpdir()`**，文件名带 `process.pid` 避免并发撞车，用完 `unlinkSync`。
- **别把断言写在源文件里**：`check-ptac-budget.js` 的「D 段自测」就是这样做的 —— 它把 `computeUnitBudget` 抽出来喂**合成 unit**，从而能验证「自检本身是否写错了」（否则一个写错的自检会永远显示通过）。
- 需要 DOM 时优先**喂数据**而不是**造环境**：解析类逻辑把 HTML 当字符串/`DOMParser` 输入，别去 mock 整个 `document`。

## 现有测试

| 文件 | 覆盖 | 对应记录 |
|------|------|----------|
| `check-ptac-budget.js` | PTAutoCheckIn 的 **A** 常量不变式 / **B** 状态阶梯结构（`STATUS_TRANSITIONS`）/ **C** 配置区不透明步骤的 `budgetMs`/`alreadyCheckBudgetMs` 声明 / **D** 抽出 `computeUnitBudget` 喂 10 个合成 unit 自测 | `memory-bank/pitfalls.md` **P28** |

## 待铺的路（候选，按价值排序）

1. **PTAutoCheckIn 场景矩阵**（TASK015 的 T14）——每项对应一个已发现缺陷，防重构回归：
   慢加载不误判 failed / 冷却与 `detect_only` 与 `suspect` 不被超时改写 / 双标签并发 `success` 不被覆盖 / 慢跳转不误判 / 预算不变式 / 既有行为基线（跨天守卫 P23、P25 重现降级恢复、P27 文本站信号等价性）。
2. **纯函数抽取**（TASK015 的 T13）——把状态阶梯守卫、预算计算、`deriveStateSignals`/`readEntryState`、超时分类抽成不依赖闭包的函数，使 1 的矩阵可直接断言。**注意**：抽取后阶梯/预算的逻辑副本会消失，`check-ptac-budget.js` 的 C 段正则检查届时可改为直接 import。
3. **BTSchoolHelper `parseTorrentTable` 回归**——用真实样本 HTML 断言列定位与字段值；可先为现存 Bug（P2 时魔浮点、P10 命名不一致）写失败断言，再修生产代码。
4. **仓库元数据一致性检查**——遍历 `src/*.user.js` 校验 `@version` 格式（`YYYY.MM.DD.N`）、`@match` 与 `SITES` 域名是否对得上、`@grant` 与用到的 GM API 是否匹配（TASK010 发布自动化的前置）。

> 关于 fixture：`src/BTSchoolTorrentsTableSample.html` 目前放在 `src/`（历史上与脚本同目录便于对照）。若第 3 项落地，建议迁到 `tests/fixtures/` 并同步更新 `conventions.md` §7、`techContext.md`、`scripts/BTSchoolHelper.md` 的引用。

## 与知识库的关系

- 新增/改名测试后，同步更新：本文件「现有测试」表、`memory-bank/techContext.md` 的「测试」条目、`memory-bank/conventions.md` §7/§10（若改变了工作流）、`memory-bank/projectbrief.md` 的仓库结构块。
- 测试暴露出的真实缺陷 → 记入 `memory-bank/pitfalls.md`（症状 → 原因 → 对策），必要时在 `memory-bank/tasks/` 建任务。
- 本目录文件**无 `@version` 头**，不参与「版本号铁律」（该铁律只约束 `src/*.user.js`）。
