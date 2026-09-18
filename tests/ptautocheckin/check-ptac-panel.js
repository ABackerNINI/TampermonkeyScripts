#!/usr/bin/env node
/*
 * check-ptac-panel.js —— PTAutoCheckIn 主面板(主弹出 UI)两条交互不变式的静态校验器(零依赖)
 *
 * 背景(2026.09.19.4 用户需求):
 *   ① 主面板改为**失焦自动关闭**: 焦点离开它(点面板外 / 切标签页 / 切窗口)即收起, 不再常驻遮挡页面;
 *   ② **检测到签到按钮重现时不弹出主面板**: 重现提醒只在页面级呈现(按钮描边 + ⚠ 徽标 + 底部横条
 *      + 首次降级的一条琥珀 toast), 不把面板弹到用户面前抢焦点。
 *
 * 为什么用静态校验而不是浏览器实测: 面板挂在 **closed shadow DOM** 下(见 P29/S05: 宿主页面脚本
 * 不得读到面板内容), 外部(含 CDP / 页面脚本)拿不到 `panel` 元素, 无法断言它的显隐; 而这两条又是
 * 「改一行就破」的易碎约定 —— 尤其是 ②, 一旦有人为了"提醒更醒目"在重现分支里补一句
 * `UI.openPanel()`, 用户看签到按钮时就会被面板糊一脸。故在此把约定钉死, 提交前可拦截。
 *
 * 校验内容:
 *   A. 失焦自动关闭接线
 *      A1 openPanel() 挂监听(armAutoClose) / closePanel() 摘监听(disarmAutoClose)
 *      A2 arm 挂的是 document 捕获阶段的 mousedown + window 的 blur(两条失焦通道都在)
 *      A3 disarm 与 arm 成对: 同样的三个参数(事件名/处理函数/捕获标记)逐一 removeEventListener
 *         捕获标记不对称会静默漏摘 → 面板收起后监听器常驻, 每次点页面都多跑一次判定。
 *      A4 「点在 UI 自身」要豁免: 处理函数里必须有 host.contains(e.target) 之类的自身判定,
 *         否则点面板里的按钮(批量签到/外观)会把自己关掉。
 *      A5 待决横幅豁免: 两个处理函数都要先查 bannerHasAction() —— 「中断恢复」是一次性入口,
 *         用户点了页面别处就被收起就再也找不回来了。
 *   B. 重现提醒不弹主面板
 *      B1 按钮重现复核分支(runUnitInner 第 1 步)内不得出现 openPanel
 *      B2 该分支的页面级呈现必须走统一入口 presentReappearedOnPage(不得绕过)
 *      B3 presentReappearedOnPage 自身不得出现 openPanel, 且必须含 uiActive() 守卫
 *         (后台任务标签无 UI, 不能在那里弹任何东西)
 *
 * 用法:
 *   node tests/ptautocheckin/check-ptac-panel.js            # 校验, 有问题 exit 1
 *   node tests/ptautocheckin/check-ptac-panel.js --quiet    # 只输出失败项
 *   node tests/run-all.js                                   # 跑全部测试(本文件是其中之一)
 *
 * 注: 开发期校验工具(tests/ 下, 非 userscript), 无 @version 头, 不参与 @version 铁律; 只读源文件。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');

const quiet = process.argv.indexOf('--quiet') >= 0;
const problems = [];

function fail(code, msg) { problems.push(`${code}  ${msg}`); }
function ok(code, msg) { if (!quiet) console.log(`  \u2714 ${code}  ${msg}`); }
function has(re, text, code, msg) {
    if (re.test(text)) { ok(code, msg); return true; }
    fail(code, msg);
    return false;
}

if (!fs.existsSync(SRC)) {
    console.error(`找不到源文件: ${SRC}`);
    process.exit(2);
}
const src = fs.readFileSync(SRC, 'utf8');

// 取出某个具名函数的函数体(大括号配平, 不解析语法; 只看顶层声明 `function name(`)
function bodyOf(name) {
    const head = src.indexOf(`function ${name}(`);
    if (head < 0) return '';
    let i = src.indexOf('{', head);
    if (i < 0) return '';
    let depth = 0;
    for (; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return src.slice(src.indexOf('{', head), i + 1);
        }
    }
    return '';
}

if (!quiet) {
    console.log('PTAutoCheckIn 主面板交互不变式校验');
    console.log('='.repeat(72));
    console.log('A. 失焦自动关闭接线');
}

// ---------- A. 失焦自动关闭 ----------
const openBody = bodyOf('openPanel');
const closeBody = bodyOf('closePanel');
const armBody = bodyOf('armAutoClose');
const disarmBody = bodyOf('disarmAutoClose');
const downBody = bodyOf('onOutsideDown');

if (!openBody || !closeBody || !armBody || !disarmBody || !downBody) {
    fail('A0', 'openPanel / closePanel / armAutoClose / disarmAutoClose / onOutsideDown 中有函数缺失');
} else {
    has(/armAutoClose\(\)/, openBody, 'A1', 'openPanel() 挂上失焦监听(armAutoClose)');
    has(/disarmAutoClose\(\)/, closeBody, 'A1', 'closePanel() 摘掉失焦监听(disarmAutoClose)');

    has(/document\.addEventListener\(\s*'mousedown',\s*onOutsideDown,\s*true\s*\)/, armBody,
        'A2', "挂了 document 捕获阶段的 mousedown(点在面板外)");
    has(/window\.addEventListener\(\s*'blur',\s*onWindowBlur\s*\)/, armBody,
        'A2', "挂了 window 的 blur(切标签页/切窗口)");

    has(/document\.removeEventListener\(\s*'mousedown',\s*onOutsideDown,\s*true\s*\)/, disarmBody,
        'A3', '摘除 mousedown 时捕获标记与挂接一致(true)');
    has(/window\.removeEventListener\(\s*'blur',\s*onWindowBlur\s*\)/, disarmBody,
        'A3', '摘除 window blur');

    has(/host\.contains\(/, downBody, 'A4', '点在 UI 自身(shadow 事件重定向到 host)时不关闭');
    has(/bannerHasAction\(\)/, downBody, 'A5', '有待决横幅时 mousedown 不自动关闭');
    has(/bannerHasAction\(\)/, bodyOf('onWindowBlur'), 'A5', '有待决横幅时失焦不自动关闭');
}

// ---------- B. 重现提醒不弹主面板 ----------
if (!quiet) console.log('B. 签到按钮重现不弹主面板');

const branchStart = src.indexOf('if (isSuccessToday(unit.id) || suspectToday) {');
const branchEnd = src.indexOf("reason: downgraded ? 'suspect' : 'done_today'", branchStart);
if (branchStart < 0 || branchEnd < 0) {
    fail('B0', '未定位到 runUnitInner 的「按钮重现复核」分支(锚点字符串变了?)');
} else {
    const branch = src.slice(branchStart, branchEnd);
    if (!/openPanel/.test(branch)) ok('B1', '复核分支内无 openPanel(重现不弹主面板)');
    else fail('B1', '复核分支内出现 openPanel —— 重现提醒不得弹出主面板');

    // 页面级呈现必须走统一入口: 「确认重现」这段里若直接调 highlightReappearedBtn /
    // renderPageAlertBar(绕过 presentReappearedOnPage), 后续有人顺手在旁边补一句
    // "顺便把面板弹出来"就没人拦得住。(清除分支里的 clearReappearedBtn/renderPageAlertBar
    // 属"收掉装饰", 不在本条校验范围内。)
    const pStart = branch.indexOf('const btnText = checkInButtonReappeared(unit);');
    const pEnd = branch.indexOf('// 其余(offToday');
    if (pStart < 0 || pEnd < 0) {
        fail('B2', '未定位到复核分支内的「确认重现」段落(锚点字符串变了?)');
    } else {
        const present = branch.slice(pStart, pEnd);
        if (/highlightReappearedBtn\(|renderPageAlertBar\(/.test(present)) {
            fail('B2', '「确认重现」段落绕过 presentReappearedOnPage 直接呈现(应走统一入口以保住「不弹面板」策略)');
        } else if (!/presentReappearedOnPage\(/.test(present)) {
            fail('B2', '「确认重现」段落没有走 presentReappearedOnPage(页面级呈现入口丢了)');
        } else {
            ok('B2', '「确认重现」段落统一走 presentReappearedOnPage');
        }
    }
}

const presentBody = bodyOf('presentReappearedOnPage');
if (!presentBody) {
    fail('B3', 'presentReappearedOnPage 缺失(重现呈现的统一入口)');
} else {
    if (!/openPanel/.test(presentBody)) ok('B3', 'presentReappearedOnPage 内无 openPanel');
    else fail('B3', 'presentReappearedOnPage 内出现 openPanel —— 重现提醒不得弹出主面板');
    has(/uiActive\(\)/, presentBody, 'B3', 'presentReappearedOnPage 有 uiActive() 守卫(后台标签不呈现)');
}

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));

if (problems.length) {
    console.error(`\n\u2718 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 面板交互改动请回到 UI IIFE 内的 openPanel/closePanel 与');
    console.error('presentReappearedOnPage(页面级呈现)这两处, 不要在各分支里各写一套。');
    process.exit(1);
}
console.log('\n\u2714 主面板交互不变式通过(失焦自动关闭 / 重现不弹面板)。');
