#!/usr/bin/env node
/*
 * check-ptac-budget.js —— PTAutoCheckIn 超时预算 / 状态阶梯 静态校验器(零依赖)
 *
 * 为什么需要它(见 memory-bank/pitfalls.md P28):
 *   PTAutoCheckIn 单站执行内部是**串行**的若干等待(已签检测 → 步骤 → 点击后观察窗 → 首轮复检),
 *   各自带超时且会累加。一旦"声明的最坏成本之和"超过整流程硬超时(UNIT_TOTAL_TIMEOUT), 该站
 *   必然在等结果途中被硬超时打断, 永远拿不到 success —— 这就是"网页加载慢一点就失败"的
 *   结构性来源。旧版 25s 上限下 NodeLoc 已越界却无人察觉, 因为没有任何东西在校验它。
 *
 * 校验三类不变式(全部毫秒):
 *   A. 常量不变式
 *      A1  UNIT_TIMEOUT_MARGIN_MS >= POST_CLICK_WATCH_MS
 *          观察窗在内部 deadline 之外仍有 4s 的硬等待, 余量必须盖得住这次溢出。
 *      A2  UNIT_TOTAL_TIMEOUT + SETTLE_MARGIN < PER_UNIT_TIMEOUT_MS
 *          整流程硬超时之后还要留出落盘 + 落地页结算的时间, 否则调度窗口会先掐断。
 *      A3  POST_CLICK_WATCH_MS + UNCONFIRMED_RECHECK_DELAYS[0] + RECHECK_DETECT_CAP_MS
 *            + UNIT_TIMEOUT_MARGIN_MS <= UNIT_TOTAL_TIMEOUT
 *          必须给"首轮复检"留出预算 —— 复检是把慢站从 unconfirmed 拉回 success 的唯一机制,
 *          预算不够它就不会执行, 慢站等于没有救场手段。
 *      A4  NO_PROGRESS_SKIP_MS < PER_UNIT_TIMEOUT_MS
 *          零进度提前跳过必须早于调度窗口上限, 否则死站仍会占满整个窗口。
 *      A5  POST_CLICK_SETTLE <= POST_CLICK_WATCH_MS
 *      A6  ELEMENT_WAIT_TIMEOUT <= UNIT_TOTAL_TIMEOUT / 2
 *          单次元素等待不该吃掉半个整流程预算。
 *   B. 状态阶梯结构(STATUS_TRANSITIONS)
 *      B1  所有目标状态都是已知状态
 *      B2  无自环
 *      B3  success 的出边只允许 suspect  —— 「已确认成功」不得被任何不确定结果覆盖
 *      B4  suspect 的出边只允许 success  —— 「失败-待确认」只能由页面确认来解除
 *      B5  「有结论」的状态(success/suspect/failed/unconfirmed)不得转入 pending
 *          —— 在途标记不可复活(防慢定时器把已有结论改回"进行中")。
 *          注意 skipped 不算结论(它=本次没动作, 如冷却中/今日已完成), '' 是初始态,
 *          二者都必须能转入 pending, 否则「上次无动作 → 这次真点击」的路径会被阶梯拒绝。
 *      B6  初始态 '' 必须能到达 success
 *   C. 不透明步骤必须声明成本
 *      C1  配置区每个 `type: 'function'` 步骤附近必须有 `budgetMs:`
 *      C2  每个 `alreadyCheck:` 附近必须有 `alreadyCheckBudgetMs:`
 *          (运行时 auditUnitBudgets() 会按声明求和; 未声明即报 UNKNOWN 判为不通过,
 *           这里做提交前的静态拦截, 免得起浏览器才发现。)
 *   D. 预算自检逻辑自测(把源文件里的 computeUnitBudget 抽出来喂合成 unit)
 *      D1  AUDIT_RESERVE_MS == 余量 + 观察窗 + 首轮复检
 *      D2  合法 unit 通过 / 未声明成本与越界 unit 被拒
 *          —— 防止"自检本身写错了于是永远显示通过"。
 *
 * 用法(见 tests/README.md):
 *   node tests/check-ptac-budget.js            # 校验, 有问题 exit 1
 *   node tests/check-ptac-budget.js --quiet    # 只输出失败项
 *   node tests/run-all.js                      # 跑 tests/ 下全部测试(本文件是其中之一)
 *
 * 注: 本文件是开发期校验工具(tests/ 下, 非 userscript), 无 @version 头, 不参与 @version 铁律;
 *     只读 src/PTAutoCheckIn.user.js, 不写任何文件(临时模块写在 os.tmpdir() 且用完即删)。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');

// A2 的结算余量: 整流程超时后落盘 + 落地页结算所需(与脚本内 PER_UNIT_TIMEOUT_MS 注释口径一致)
const SETTLE_MARGIN_MS = 5 * 1000;

const quiet = process.argv.indexOf('--quiet') >= 0;
const problems = [];
const notes = [];

function fail(code, msg) { problems.push(`${code}  ${msg}`); }
function note(msg) { notes.push(msg); }
function ok(code, msg) { if (!quiet) console.log(`  \u2714 ${code}  ${msg}`); }

// ---------- 读源文件 ----------
if (!fs.existsSync(SRC)) {
    console.error(`找不到源文件: ${SRC}`);
    process.exit(2);
}
const src = fs.readFileSync(SRC, 'utf8');

// ---------- 顶层常量提取 ----------
// 只接受纯算术表达式(数字/括号/四则运算), 拒绝一切其它字符 → 用 Function 求值是安全的。
const ARITH_OK = /^[0-9+\-*/().\s_]+$/;
const CONSTS = {};
{
    const re = /^const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;]+);/gm;
    let m;
    while ((m = re.exec(src))) {
        const name = m[1];
        const expr = m[2].trim();
        if (ARITH_OK.test(expr)) {
            try {
                // eslint-disable-next-line no-new-func
                const v = Function(`"use strict";return (${expr});`)();
                if (typeof v === 'number' && isFinite(v)) CONSTS[name] = v;
            } catch (e) { /* 非算术, 跳过 */ }
        } else if (/^\[[\d,\s]+\]$/.test(expr)) {
            CONSTS[name] = expr.slice(1, -1).split(',').map((s) => Number(s.trim()));
        }
    }
}

const need = [
    'UNIT_TOTAL_TIMEOUT', 'UNIT_TIMEOUT_MARGIN_MS', 'PER_UNIT_TIMEOUT_MS',
    'POST_CLICK_SETTLE', 'POST_CLICK_WATCH_MS', 'NO_PROGRESS_SKIP_MS',
    'ELEMENT_WAIT_TIMEOUT', 'RECHECK_DETECT_CAP_MS', 'UNCONFIRMED_RECHECK_DELAYS'
];
const missing = need.filter((n) => CONSTS[n] === undefined);
if (missing.length) {
    console.error(`无法从源文件解析出这些常量(改名了? 或被拆成非常量表达式?): ${missing.join(', ')}`);
    process.exit(2);
}

const {
    UNIT_TOTAL_TIMEOUT, UNIT_TIMEOUT_MARGIN_MS, PER_UNIT_TIMEOUT_MS,
    POST_CLICK_SETTLE, POST_CLICK_WATCH_MS, NO_PROGRESS_SKIP_MS,
    ELEMENT_WAIT_TIMEOUT, RECHECK_DETECT_CAP_MS, UNCONFIRMED_RECHECK_DELAYS
} = CONSTS;

if (!quiet) {
    console.log('PTAutoCheckIn 预算 / 阶梯校验');
    console.log('='.repeat(72));
    console.log(`  UNIT_TOTAL_TIMEOUT      = ${UNIT_TOTAL_TIMEOUT}ms`);
    console.log(`  UNIT_TIMEOUT_MARGIN_MS  = ${UNIT_TIMEOUT_MARGIN_MS}ms`);
    console.log(`  PER_UNIT_TIMEOUT_MS     = ${PER_UNIT_TIMEOUT_MS}ms`);
    console.log(`  POST_CLICK_WATCH_MS     = ${POST_CLICK_WATCH_MS}ms`);
    console.log(`  UNCONFIRMED_RECHECK_DELAYS = [${UNCONFIRMED_RECHECK_DELAYS.join(', ')}]`);
    console.log(`  RECHECK_DETECT_CAP_MS   = ${RECHECK_DETECT_CAP_MS}ms`);
    console.log(`  NO_PROGRESS_SKIP_MS     = ${NO_PROGRESS_SKIP_MS}ms`);
    console.log('-'.repeat(72));
}

// ---------- A. 常量不变式 ----------
if (!quiet) console.log('A. 常量不变式');

if (UNIT_TIMEOUT_MARGIN_MS >= POST_CLICK_WATCH_MS) {
    ok('A1', `余量 ${UNIT_TIMEOUT_MARGIN_MS}ms >= 观察窗 ${POST_CLICK_WATCH_MS}ms`);
} else {
    fail('A1', `余量 ${UNIT_TIMEOUT_MARGIN_MS}ms < 观察窗 ${POST_CLICK_WATCH_MS}ms: 观察窗在内部 deadline 外的溢出无法被余量吸收, 会撞上硬超时`);
}

if (UNIT_TOTAL_TIMEOUT + SETTLE_MARGIN_MS < PER_UNIT_TIMEOUT_MS) {
    ok('A2', `整流程 ${UNIT_TOTAL_TIMEOUT}ms + 结算余量 ${SETTLE_MARGIN_MS}ms < 调度窗口 ${PER_UNIT_TIMEOUT_MS}ms`);
} else {
    fail('A2', `整流程 ${UNIT_TOTAL_TIMEOUT}ms + 结算余量 ${SETTLE_MARGIN_MS}ms >= 调度窗口 ${PER_UNIT_TIMEOUT_MS}ms: 落盘/落地结算会被调度窗口掐断`);
}

const firstRecheckMs = (UNCONFIRMED_RECHECK_DELAYS[0] || 0) + RECHECK_DETECT_CAP_MS;
const reserveNeeded = UNIT_TIMEOUT_MARGIN_MS + POST_CLICK_WATCH_MS + firstRecheckMs;
if (reserveNeeded <= UNIT_TOTAL_TIMEOUT) {
    ok('A3', `余量${UNIT_TIMEOUT_MARGIN_MS} + 观察窗${POST_CLICK_WATCH_MS} + 首轮复检${firstRecheckMs} = ${reserveNeeded}ms <= ${UNIT_TOTAL_TIMEOUT}ms`);
    note(`留给站点自身(检测 + 步骤)的预算上限 = ${UNIT_TOTAL_TIMEOUT - reserveNeeded}ms`);
} else {
    fail('A3', `固定预留 ${reserveNeeded}ms > 整流程 ${UNIT_TOTAL_TIMEOUT}ms: 首轮复检(慢站唯一的救场机制)没有预算可用`);
}

if (NO_PROGRESS_SKIP_MS < PER_UNIT_TIMEOUT_MS) {
    ok('A4', `零进度跳过 ${NO_PROGRESS_SKIP_MS}ms < 调度窗口 ${PER_UNIT_TIMEOUT_MS}ms`);
} else {
    fail('A4', `零进度跳过 ${NO_PROGRESS_SKIP_MS}ms >= 调度窗口 ${PER_UNIT_TIMEOUT_MS}ms: 死站仍会占满整个窗口`);
}

if (POST_CLICK_SETTLE <= POST_CLICK_WATCH_MS) {
    ok('A5', `最小观察 ${POST_CLICK_SETTLE}ms <= 观察窗上限 ${POST_CLICK_WATCH_MS}ms`);
} else {
    fail('A5', `最小观察 ${POST_CLICK_SETTLE}ms > 观察窗上限 ${POST_CLICK_WATCH_MS}ms: 语义倒置`);
}

if (ELEMENT_WAIT_TIMEOUT * 2 <= UNIT_TOTAL_TIMEOUT) {
    ok('A6', `单次元素等待 ${ELEMENT_WAIT_TIMEOUT}ms <= 半个整流程预算(${UNIT_TOTAL_TIMEOUT / 2}ms)`);
} else {
    fail('A6', `单次元素等待 ${ELEMENT_WAIT_TIMEOUT}ms > 半个整流程预算(${UNIT_TOTAL_TIMEOUT / 2}ms): 一次等待就吃掉半个预算`);
}

// ---------- B. 状态阶梯结构 ----------
if (!quiet) console.log('B. 状态阶梯 STATUS_TRANSITIONS');

const KNOWN = ['success', 'failed', 'pending', 'skipped', 'suspect', 'unconfirmed'];
let LADDER = null;
{
    const start = src.indexOf('const STATUS_TRANSITIONS');
    if (start < 0) {
        fail('B0', '未找到 STATUS_TRANSITIONS 定义');
    } else {
        const bodyStart = src.indexOf('{', start);
        let depth = 0, end = -1;
        for (let i = bodyStart; i < src.length; i++) {
            const c = src[i];
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end < 0) {
            fail('B0', 'STATUS_TRANSITIONS 括号不闭合');
        } else {
            const body = src.slice(bodyStart + 1, end);
            LADDER = {};
            const entryRe = /(?:'([a-z]*)'|([A-Za-z_$][\w$]*))\s*:\s*\[([^\]]*)\]/g;
            let em;
            while ((em = entryRe.exec(body))) {
                const key = em[1] !== undefined ? em[1] : em[2];
                const vals = em[3].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
                LADDER[key] = vals;
            }
            if (!Object.keys(LADDER).length) fail('B0', 'STATUS_TRANSITIONS 解析为空');
        }
    }
}

if (LADDER) {
    let bad = false;
    // B1
    for (const [from, tos] of Object.entries(LADDER)) {
        for (const t of tos) {
            if (KNOWN.indexOf(t) < 0) { fail('B1', `未知目标状态 '${t}'(来自 '${from}')`); bad = true; }
        }
    }
    if (!bad) ok('B1', '所有目标状态均为已知状态');

    // B2
    const selfLoops = [];
    for (const [from, tos] of Object.entries(LADDER)) {
        if (tos.indexOf(from) >= 0) selfLoops.push(from);
    }
    if (!selfLoops.length) ok('B2', '无自环');
    else fail('B2', `存在自环: ${selfLoops.join(', ')}`);

    // B3 / B4
    const succ = (LADDER.success || []).slice().sort();
    const susp = (LADDER.suspect || []).slice().sort();
    if (succ.length === 0 || (succ.length === 1 && succ[0] === 'suspect')) {
        ok('B3', `success 出边 = [${succ.join(', ') || '无'}] ⊆ [suspect]`);
    } else {
        fail('B3', `success 出边 = [${succ.join(', ')}] ⊄ [suspect]: 「已确认成功」可被非 suspect 结果覆盖(F1 类回归风险)`);
    }
    if (susp.length === 0 || (susp.length === 1 && susp[0] === 'success')) {
        ok('B4', `suspect 出边 = [${susp.join(', ') || '无'}] ⊆ [success]`);
    } else {
        fail('B4', `suspect 出边 = [${susp.join(', ')}] ⊄ [success]: 「失败-待确认」可被非页面确认结果改写`);
    }

    // B5: 有结论的状态不得转入 pending(skipped/'' 除外 —— 它们无结论, 必须能开新动作)
    const CONCLUSIONS = ['success', 'suspect', 'failed', 'unconfirmed'];
    const intoPending = CONCLUSIONS
        .filter((s) => (LADDER[s] || []).indexOf('pending') >= 0);
    if (!intoPending.length) ok('B5', `无「有结论」状态可转入 pending(结论不可被改回在途)`);
    else fail('B5', `这些有结论的状态可转入 pending: ${intoPending.join(', ')}: 慢定时器能把已有结论改回"进行中"`);

    // B6
    const init = LADDER[''] || [];
    if (init.indexOf('success') >= 0) ok('B6', `初始态可直达 success`);
    else fail('B6', `初始态出边 [${init.join(', ')}] 不含 success`);

    if (!quiet) {
        console.log('  阶梯全量(供人工复核):');
        for (const [from, tos] of Object.entries(LADDER)) {
            console.log(`    ${(from || '(初始)').padEnd(12)} -> ${tos.join(', ') || '(终态)'}`);
        }
    }
}

// ---------- C. 不透明步骤必须声明成本 ----------
if (!quiet) console.log('C. 不透明步骤的预算声明');

{
    const sIdx = src.indexOf('const SITES = [');
    let regionEnd = -1;
    if (sIdx >= 0) {
        // 配置区以 4 空格缩进的 `];` 收尾(嵌套数组收在更深缩进, 不会误判)
        const rest = src.slice(sIdx);
        const closeRe = /\n {4}\];/;
        const cm = closeRe.exec(rest);
        if (cm) regionEnd = sIdx + cm.index + cm[0].length;
    }
    if (sIdx < 0 || regionEnd < 0) {
        fail('C0', '无法定位配置区(const SITES = [ ... \\n    ];)');
    } else {
        const baseLine = src.slice(0, sIdx).split('\n').length; // sIdx 所在行号(1-based)
        const region = src.slice(sIdx, regionEnd);
        const lines = region.split('\n');
        const endLine = src.slice(0, regionEnd).split('\n').length;

        const fnSteps = [];
        const alreadyChecks = [];
        lines.forEach((ln, i) => {
            if (/type\s*:\s*['"]function['"]/.test(ln)) fnSteps.push(i);
            // alreadyCheck: async () => / alreadyCheck: () => 均算; 注意别匹配到 alreadyCheckBudgetMs
            if (/alreadyCheck\s*:\s*(async\s*)?\(/.test(ln)) alreadyChecks.push(i);
        });

        // 声明可写在字段上方或下方 → 前后各扫 span 行
        const hasAround = (i, re, span) => {
            const lo = Math.max(0, i - span), hi = Math.min(lines.length, i + span + 1);
            for (let k = lo; k < hi; k++) if (re.test(lines[k])) return true;
            return false;
        };
        const BUDGET_FIELD = /(?:^|[^A-Za-z])budgetMs\s*:/; // 排除 alreadyCheckBudgetMs 的误匹配

        const badFn = fnSteps.filter((i) => !hasAround(i, BUDGET_FIELD, 15));
        const badAc = alreadyChecks.filter((i) => !hasAround(i, /alreadyCheckBudgetMs\s*:/, 8));

        if (!badFn.length) ok('C1', `${fnSteps.length} 个 function 步骤均已声明 budgetMs`);
        else {
            for (const i of badFn) {
                const desc = (/(description\s*:\s*'([^']*)')/.exec(lines[i]) || [])[2] || lines[i].trim();
                fail('C1', `src/PTAutoCheckIn.user.js:${baseLine + i} 的 function 步骤未声明 budgetMs: ${desc}`);
            }
        }
        if (!badAc.length) ok('C2', `${alreadyChecks.length} 个 alreadyCheck 均已声明 alreadyCheckBudgetMs`);
        else {
            for (const i of badAc) {
                fail('C2', `src/PTAutoCheckIn.user.js:${baseLine + i} 的 alreadyCheck 未声明 alreadyCheckBudgetMs(同步判定写 0)`);
            }
        }
        note(`配置区 = 第 ${baseLine}..${endLine} 行; 含 ${fnSteps.length} 个 function 步骤 / ${alreadyChecks.length} 个 alreadyCheck(不透明成本需声明)`);
    }
}

// ---------- D. 预算自检逻辑自测 ----------
if (!quiet) console.log('D. 预算自检逻辑自测(computeUnitBudget)');

{
    // 把源文件里运行时用的三个定义原样抽出(自包含, 只依赖常量与 CLICK_CHECK_IN)
    const a = src.indexOf('const AUDIT_RESERVE_MS');
    const b = src.indexOf('// 全站预算审计');
    const clickTimeout = Number((/const CLICK_CHECK_IN = \{[\s\S]*?timeout:\s*(\d+)/.exec(src) || [])[1]);
    if (a < 0 || b < 0 || !isFinite(clickTimeout)) {
        fail('D0', '无法从源文件抽出 AUDIT_RESERVE_MS / computeUnitBudget / CLICK_CHECK_IN.timeout');
    } else {
        const prelude = [
            `const UNIT_TOTAL_TIMEOUT = ${UNIT_TOTAL_TIMEOUT}, UNIT_TIMEOUT_MARGIN_MS = ${UNIT_TIMEOUT_MARGIN_MS}, POST_CLICK_WATCH_MS = ${POST_CLICK_WATCH_MS};`,
            `const UNCONFIRMED_RECHECK_DELAYS = [${UNCONFIRMED_RECHECK_DELAYS.join(', ')}], RECHECK_DETECT_CAP_MS = ${RECHECK_DETECT_CAP_MS}, ELEMENT_WAIT_TIMEOUT = ${ELEMENT_WAIT_TIMEOUT};`,
            `const CLICK_CHECK_IN = { type: 'click_checkin', description: 'x', timeout: ${clickTimeout} };`
        ].join('\n');
        const tmp = path.join(require('os').tmpdir(), `ptac-audit-${process.pid}.js`);
        let computeUnitBudget = null, AUDIT_RESERVE_MS = 0;
        try {
            fs.writeFileSync(tmp, `${prelude}\n${src.slice(a, b)}\nmodule.exports = { computeUnitBudget, AUDIT_RESERVE_MS };\n`);
            const mod = require(tmp);
            computeUnitBudget = mod.computeUnitBudget;
            AUDIT_RESERVE_MS = mod.AUDIT_RESERVE_MS;
        } catch (e) {
            fail('D0', `抽出 computeUnitBudget 失败: ${e.message}`);
        } finally {
            try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
        }

        if (computeUnitBudget) {
            const expectReserve = UNIT_TIMEOUT_MARGIN_MS + POST_CLICK_WATCH_MS + firstRecheckMs;
            if (AUDIT_RESERVE_MS === expectReserve) {
                ok('D1', `AUDIT_RESERVE_MS = ${AUDIT_RESERVE_MS}ms = 余量 + 观察窗 + 首轮复检`);
            } else {
                fail('D1', `AUDIT_RESERVE_MS = ${AUDIT_RESERVE_MS}ms, 期望 ${expectReserve}ms(余量 + 观察窗 + 首轮复检)`);
            }

            // [名称, 合成 unit, 期望通过?]
            const cases = [
                ['默认站(缺省 [CLICK_CHECK_IN])', {}, true],
                ['HDBao/MuXueGe(click+wait+click_checkin)', { steps: [
                    { type: 'click', timeout: 5000, ignoreError: true },
                    { type: 'wait', ms: 1500 },
                    { type: 'click_checkin', timeout: 5000, ignoreError: true }] }, true],
                ['蜂巢 pting(多步含可选点击)', { steps: [
                    { type: 'wait', ms: 5000 }, { type: 'click_checkin', timeout: 5000 }, { type: 'wait', ms: 1000 },
                    { type: 'click', timeout: 2000, ignoreError: true }, { type: 'wait', ms: 800 },
                    { type: 'click', timeout: 2000, ignoreError: true }] }, true],
                ['HHCLUB(function 8400 + alreadyCheck 3000)', { alreadyCheckBudgetMs: 3000, alreadyCheck: () => {}, steps: [
                    { type: 'function', budgetMs: 8400 }, { type: 'click_checkin', timeout: 5000 }] }, true],
                ['NodeLoc(function 10000 + 同步 alreadyCheck 0)', { alreadyCheckBudgetMs: 0, alreadyCheck: () => {}, steps: [
                    { type: 'function', budgetMs: 10000 }] }, true],
                ['隐式签到站(MTeam 等, 仅 wait 3000)', { steps: [{ type: 'wait', ms: 3000 }] }, true],
                ['function 步骤未声明成本 → 拒', { steps: [{ type: 'function' }] }, false],
                ['alreadyCheck 未声明成本 → 拒', { alreadyCheck: () => {} }, false],
                ['未知步骤类型 → 拒', { steps: [{ type: 'teleport' }] }, false],
                ['越界(function 30000 + alreadyCheck 12000) → 拒', { alreadyCheckBudgetMs: 12000, alreadyCheck: () => {}, steps: [
                    { type: 'function', budgetMs: 30000 }] }, false]
            ];
            let mismatched = 0;
            const detail = [];
            for (const [name, unit, want] of cases) {
                const r = computeUnitBudget(Object.assign({ id: 'x', name }, unit));
                if (r.ok !== want) { mismatched++; detail.push(`${name}(得到 ${r.ok ? '通过' : '拒绝'}, 期望 ${want ? '通过' : '拒绝'})`); }
                if (!quiet) {
                    console.log(`    ${r.ok === want ? '\u00b7' : '!'} ${(want ? '[应通过]' : '[应拒绝]')} ${name}  =>  ${r.total}ms${r.unknown.length ? ' UNKNOWN:' + r.unknown.join(',') : ''}`);
                }
            }
            if (!mismatched) ok('D2', `${cases.length} 个合成用例的判定全部符合预期`);
            else for (const d of detail) fail('D2', `用例判定不符: ${d}`);
        }
    }
}

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));
if (!quiet) for (const n of notes) console.log(`  \u2139 ${n}`);

if (problems.length) {
    console.error(`\n\u2718 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 调整常量, 或为不透明步骤补 budgetMs / alreadyCheckBudgetMs。');
    console.error('另: 脚本启动时也会跑同一套逐站求和(运行时 auditUnitBudgets), 越界会在页面 console 报出。');
    process.exit(1);
}
console.log('\n\u2714 全部不变式通过。');
