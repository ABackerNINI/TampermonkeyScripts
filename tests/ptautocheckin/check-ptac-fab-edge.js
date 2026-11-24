#!/usr/bin/env node
/*
 * check-ptac-fab-edge.js: FAB 靠边模式(C1 / C2 / C3 / C4)的静态护栏(零依赖)
 *
 * 背景(2026.11.24, 计划 26-11-24-1409 §04 C1/C2/C3, §06 D3/D6/D7/D10/D11):
 *   C1 皮肤条内加独立布尔开关(data-edge), 与 data-skin 单选钮视觉分隔(现为 2 钮, 见计划 fix2 A1);
 *      该按钮绝不能带 .skin-btn 类, 否则会被 panel.querySelectorAll('.skin-btn')
 *      收编进单选数组, 点击误调 setSkin(undefined), 皮肤被清空;
 *   C2 新增 GM 键 ptac_edge, init 用 gmGet(K.edge, false) 初始化并给 fab 加 .edge,
 *      开关点击用 gmSet(K.edge, bool) 持久化(跨站, 不引入新 GM API);
 *   C3 .fab.edge 竖线 right:20/bottom:20/width:4/height:120, 颜色继承状态 class
 *      的渐变底与 --glow; ::before 做约 24px 透明命中区(::after 已被辉光占用);
 *      hover / focus-within 时就地把宽高恢复 52px 圆钮, right/bottom 不变(不跳位).
 *   C4 状态机(面板保持展开 / 批量不缩回 / 触屏两段式 / 键盘焦点 / 失焦关闭后缩回):
 *      .edge-open 逻辑保持展开类与 :hover 同款形变; 四条件(面板/批量/触屏首段/焦点)
 *      任一成立不缩回, 指针离开命中区才移除标记; 面板 bottom:84px 仍不漂移,
 *      失焦自动关闭链本身沿用既有实现(check-ptac-panel.js 单独钉住).
 *
 * 校验内容(全部只读源文件, 不执行):
 *   C1 edge 按钮独立类且非 skin-btn, 独立 querySelector / addEventListener,
 *      不调用 setSkin / render;
 *   C2 K 表有 edge: 'ptac_edge', gmGet(K.edge, false) 初始化, gmSet(K.edge, edge) 持久化;
 *   C3 竖线四值 / 禁形变 / 命中区 / 隐藏角标 / hover 与 focus-within 展开 / 锚点不改写;
 *   边界 .panel bottom:84px 与 .chip right:84px bottom:30px 均未改;
 *   版本 @version 2026.11.24.5(动效开关化批次递增).
 *
 * 用法:
 *   node tests/ptautocheckin/check-ptac-fab-edge.js
 *   node tests/ptautocheckin/check-ptac-fab-edge.js --quiet
 *   node tests/run-all.js
 *
 * 注: 开发期校验工具(tests/ 下, 非 userscript), 无 @version 头, 不参与 @version 铁律.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');
const quiet = process.argv.indexOf('--quiet') >= 0;
const problems = [];

function fail(code, msg) { problems.push(`${code}  ${msg}`); }
function ok(code, msg) { if (!quiet) console.log(`  [OK] ${code}  ${msg}`); }
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

// 取具名 CSS 规则块(大括号配平, 不解析 CSS 语法; 选择器需与源码逐字一致)
function ruleBlock(selector) {
    const head = src.indexOf(selector + ' {');
    if (head < 0) return '';
    const brace = src.indexOf('{', head);
    if (brace < 0) return '';
    let depth = 0;
    for (let i = brace; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(brace + 1, i);
        }
    }
    return '';
}

// 取 K 对象源码(从 const K = { 到紧随的 };)
function kBlock() {
    const a = src.indexOf('const K = {');
    if (a < 0) return '';
    const b = src.indexOf('\n};', a);
    return b < 0 ? '' : src.slice(a, b);
}

// 取 setEdge 函数体(到 applyFabSkin 之前, 中间只有该函数与注释)
function setEdgeBody() {
    const a = src.indexOf('function setEdge(');
    const b = src.indexOf('function applyFabSkin(', a);
    return a < 0 || b < 0 ? '' : src.slice(a, b);
}

if (!quiet) {
    console.log('PTAutoCheckIn FAB 靠边模式静态护栏校验');
    console.log('='.repeat(72));
}

// ---------- C2. GM 键与持久化 ----------
if (!quiet) console.log('C2. GM 键 ptac_edge 与跨站持久化');

const K = kBlock();
if (!K) fail('C2', 'const K = { ... } 块缺失(锚点字符串变了?)');
else has(/\bedge:\s*'ptac_edge'/, K, 'C2', "K 表含 edge: 'ptac_edge'");

has(/edge\s*=\s*gmGet\(K\.edge,\s*false\)/, src, 'C2', 'init 用 gmGet(K.edge, false) 初始化');
has(/if\s*\(\s*edge\s*\)\s*fab\.classList\.add\('edge'\)/, src, 'C2', '靠边态启动时给 fab 加 .edge');
has(/gmSet\(K\.edge,\s*edge\)/, src, 'C2', '开关点击用 gmSet(K.edge, edge) 持久化');
has(/function gmGet\(key,\s*fallback\)/, src, 'C2', '复用现有 gmGet 封装(未引入新 GM API)');
has(/function gmSet\(key,\s*value\)/, src, 'C2', '复用现有 gmSet 封装(未引入新 GM API)');

// ---------- C1. edge 按钮 independence ----------
if (!quiet) console.log('C1. edge 开关按钮独立于 skin-btn 单选数组');

const edgeBtnMatch = /<button\b[^>]*\bdata-edge\b[^>]*>/.exec(src);
if (!edgeBtnMatch) {
    fail('C1', '未找到带 data-edge 的 button 标签');
} else {
    const tag = edgeBtnMatch[0];
    if (/class="edge-btn"/.test(tag)) ok('C1', 'edge 按钮带独立类 edge-btn');
    else fail('C1', 'edge 按钮缺独立类 edge-btn');
    if (/\bskin-btn\b/.test(tag)) fail('C1', '严重: edge 按钮带 skin-btn 类, 会被单选数组收编并误调 setSkin(undefined)');
    else ok('C1', 'edge 按钮绝不带 skin-btn 类(不被 querySelectorAll(".skin-btn") 收编)');
    if (/aria-pressed=/.test(tag)) ok('C1', 'edge 按钮用 aria-pressed 表达布尔态');
    else fail('C1', 'edge 按钮缺 aria-pressed 布尔态标记');
}

const skinBtnCount = (src.match(/class="skin-btn"/g) || []).length;
if (skinBtnCount === 2) ok('C1', `皮肤条 skin-btn 数为 2 (实际 ${skinBtnCount})`);
else fail('C1', `皮肤条 skin-btn 数应为 2, 实际 ${skinBtnCount}`);

has(/skinBtns\s*=\s*Array\.prototype\.slice\.call\(panel\.querySelectorAll\('\.skin-btn'\)\)/,
    src, 'C1', '单选数组仍用精确选择器 .skin-btn');
has(/edgeBtn\s*=\s*panel\.querySelector\('\.edge-btn'\)/, src, 'C1', 'edge 按钮独立 querySelector');
has(/edgeBtn\.addEventListener\('click'/, src, 'C1', 'edge 按钮独立 addEventListener');
has(/class="edge-sep"/, src, 'C1', 'edge 开关与皮肤单选钮之间有视觉分隔线');

const setEdge = setEdgeBody();
if (!setEdge) {
    fail('C1', 'setEdge 函数体缺失(锚点字符串变了?)');
} else {
    has(/fab\.classList\.toggle\('edge',\s*edge\)/, setEdge, 'C1', '点击即时切换 fab 的 .edge 类');
    if (/setSkin\s*\(/.test(setEdge)) fail('C1', 'setEdge 调用 setSkin, 会重置皮肤');
    else ok('C1', 'setEdge 不调用 setSkin, 切换不重置皮肤');
    if (/render\s*\(/.test(setEdge)) fail('C1', 'setEdge 调用 render, 越界触碰皮肤渲染');
    else ok('C1', 'setEdge 不触发 render(皮肤高亮与 GM 值不动)');
    has(/syncEdgeButton\(\)/, setEdge, 'C1', 'setEdge 调用 syncEdgeButton(按钮 UI 单一来源)');
    if (/aria-pressed|edge-label/.test(setEdge)) {
        fail('C1', 'setEdge 内联按钮 UI, 与 syncEdgeButton 双份语义易漂移');
    } else {
        ok('C1', 'setEdge 不内联按钮 UI(避免初始化与点击两套文案)');
    }
}

// C1 评审 major: 初始化/刷新/跨站恢复时按钮 UI 必须与 FAB 的 .edge 同步.
// 提取 syncEdgeButton 供初始化与 setEdge 共用; 初始化只读 GM, 不写回存储.
has(/function syncEdgeButton\(\)\s*\{[\s\S]{0,300}?aria-pressed[\s\S]{0,200}?edge-label/,
    src, 'C1', 'syncEdgeButton 同时同步 aria-pressed 与 .edge-label 文案');
const initBtnAt = src.indexOf("edgeBtn = panel.querySelector('.edge-btn');");
const initTail = initBtnAt < 0 ? '' : src.slice(initBtnAt, initBtnAt + 220);
if (!initTail) fail('C1', '未找到 edgeBtn 赋值语句');
else {
    has(/syncEdgeButton\(\)/, initTail, 'C1', 'edgeBtn 赋值后立即同步初始化按钮 UI');
    if (/gmSet\(K\.edge/.test(initTail)) fail('C1', '初始化恢复重复 gmSet(K.edge), 只读路径不应写回');
    else ok('C1', '初始化恢复只读 GM, 不重复写回 ptac_edge');
}

// ---------- C3. 竖线几何与展开 ----------
if (!quiet) console.log('C3. 竖线几何 / 命中区 / 色语义 / 展开不跳位');

const edgeRule = ruleBlock('.fab.edge');
if (!edgeRule) {
    fail('C3', '.fab.edge 规则块缺失(锚点字符串变了?)');
} else {
    has(/\bright:\s*20px\s*;/, edgeRule, 'C3', '竖线 right: 20px');
    has(/\bbottom:\s*20px\s*;/, edgeRule, 'C3', '竖线 bottom: 20px');
    has(/\bwidth:\s*4px\s*;/, edgeRule, 'C3', '竖线 width: 4px');
    has(/\bheight:\s*120px\s*;/, edgeRule, 'C3', '竖线 height: 120px(向上延伸)');
    has(/\banimation:\s*none\s*!important\s*;/, edgeRule, 'C3', '竖线态禁掉 chameleonWave 形变, 4px 细线不抖');
    has(/transition:[^;]*width[^;]*/, edgeRule, 'C3', '宽高变化有 transition 过渡');
    if (/#(?:[0-9a-fA-F]{3,8})\b|rgba?\(/.test(edgeRule)) {
        fail('C3', '.fab.edge 块内硬编码颜色, 应复用状态 class 渐变底与 --glow 语义');
    } else {
        ok('C3', '.fab.edge 块内无硬编码颜色(复用状态 class 渐变底与 --glow)');
    }
}

const hitRule = ruleBlock('.fab.edge::before');
if (!hitRule) {
    fail('C3', '.fab.edge::before 命中区规则缺失');
} else {
    has(/\bleft:\s*-20px\s*;/, hitRule, 'C3', '命中区向左外扩 20px');
    has(/\bwidth:\s*2[0-8]px\s*;/, hitRule, 'C3', '命中区总宽约 24px(本体 4px + 外扩 20px)');
    has(/\bheight:\s*1[3-5]\dpx\s*;/, hitRule, 'C3', '命中区纵向覆盖 120px 竖线并留余量');
    if (/pointer-events:\s*none/.test(hitRule)) fail('C3', '命中区 ::before 设了 pointer-events: none, 透明命中区失效');
    else ok('C3', '命中区用 ::before(避开已用于辉光的 ::after)且未禁用指针事件');
}

const hideRule = ruleBlock('.fab.edge .fab-core, .fab.edge .fab-badge');
if (!hideRule) {
    fail('C3', '竖线态隐藏图标/角标的规则缺失');
} else {
    has(/\bopacity:\s*0\s*;/, hideRule, 'C3', '竖线态隐藏角标数字与图标');
    has(/\bvisibility:\s*hidden\s*;/, hideRule, 'C3', '竖线态 visibility: hidden 不占视觉');
}

const hoverRule = ruleBlock('.fab.edge:hover, .fab.edge:focus-within');
if (!hoverRule) {
    fail('C3', 'hover / focus-within 展开规则缺失');
} else {
    has(/\bwidth:\s*52px\s*;/, hoverRule, 'C3', '展开恢复原 52px 宽');
    has(/\bheight:\s*52px\s*;/, hoverRule, 'C3', '展开恢复原 52px 高(圆钮)');
    has(/\bborder-radius:\s*50%\s*;/, hoverRule, 'C3', '展开恢复圆钮圆角');
    has(/\btransform:\s*none\s*;/, hoverRule, 'C3', '展开态抵消 :hover 的 translateY/scale, 实测几何严格不跳位');
    if (/\b(?:right|bottom)\s*:/.test(hoverRule)) {
        fail('C3', '展开规则改写了 right/bottom 锚点, 会导致竖线展开时跳位');
    } else {
        ok('C3', '展开规则未改写 right/bottom(双锚点计算值不变, 不跳位)');
    }
}

has(/\.fab\.edge:hover \.fab-badge[\s\S]{0,160}?opacity:\s*1[\s\S]{0,60}?visibility:\s*visible/,
    src, 'C3', '展开态恢复完整 FAB 内容与角标显示');

// ---------- 边界. 面板与芯片定位不漂移 ----------
if (!quiet) console.log('边界. 面板 bottom:84px 与 chip 定位未改(C4 依赖)');

const panelRule = ruleBlock('.panel');
if (!panelRule) fail('C4-BOUND', '.panel 规则块缺失');
else has(/\bbottom:\s*84px\s*;/, panelRule, 'C4-BOUND', '.panel bottom:84px 未改');
if (/\.panel[^{}]*\.edge[^{}]*\{[^}]*\bbottom\s*:/.test(src)) {
    fail('C4-BOUND', '出现 .panel.edge 覆盖 bottom 的规则, 竖线态面板会漂移');
} else {
    ok('C4-BOUND', '无 .panel.edge 覆盖 bottom 的规则');
}

const chipRule = ruleBlock('.chip');
if (!chipRule) fail('C4-BOUND', '.chip 规则块缺失');
else {
    has(/\bright:\s*84px\s*;/, chipRule, 'C4-BOUND', '.chip right:84px 未改');
    has(/\bbottom:\s*30px\s*;/, chipRule, 'C4-BOUND', '.chip bottom:30px 未改');
}

// ---------- C4. 靠边状态机 ----------
if (!quiet) console.log('C4. 逻辑保持展开 / 条件缩回 / 触屏两段式 / 失焦联动');

// 取具名函数的函数体(大括号配平, 不解析语法)
function bodyOf(name) {
    const head = src.indexOf(`function ${name}(`);
    if (head < 0) return '';
    const brace = src.indexOf('{', head);
    if (brace < 0) return '';
    let depth = 0;
    for (let i = brace; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(brace, i + 1);
        }
    }
    return '';
}

// C4 展开形变: 与 :hover 同款但不改锚点, 面板/竖线不漂移
const openRule = ruleBlock('.fab.edge.edge-open');
if (!openRule) {
    fail('C4', '.fab.edge.edge-open 逻辑保持展开规则缺失');
} else {
    has(/\bwidth:\s*52px\s*;/, openRule, 'C4', '逻辑保持展开恢复 52px 宽');
    has(/\bheight:\s*52px\s*;/, openRule, 'C4', '逻辑保持展开恢复 52px 高');
    has(/\btransform:\s*none\s*;/, openRule, 'C4', '展开态抵消 :hover 形变(不跳位)');
    if (/\b(?:right|bottom)\s*:/.test(openRule)) {
        fail('C4', '.edge-open 改写 right/bottom, 竖线展开会跳位');
    } else {
        ok('C4', '.edge-open 未改写双锚点');
    }
}

// 缩回判定: 四条件任一成立即保持, 指针离开才移除标记
const collapseBody = bodyOf('maybeCollapseEdge');
if (!collapseBody) {
    fail('C4', 'maybeCollapseEdge 函数体缺失(锚点字符串变了?)');
} else {
    has(/panel\.classList\.contains\('show'\)/, collapseBody, 'C4', '面板打开期间保持展开');
    has(/batchActive\(\)/, collapseBody, 'C4', '批量进行中不缩回(强制展开)');
    has(/touchStage/, collapseBody, 'C4', '触屏首段保持展开');
    has(/focusInFab\(\)/, collapseBody, 'C4', '键盘焦点在 fab 内不强制缩回');
    has(/edgeHover/, collapseBody, 'C4', '指针仍在命中区不缩回(防 hover 抖动)');
    has(/setEdgeOpen\(false\)/, collapseBody, 'C4', '四条件都不成立才移除保持标记');
}

// 触屏两段式: 首段只展开, 再点才走原有 togglePanel
const clickBody = bodyOf('onFabClick');
if (!clickBody) {
    fail('C4', 'onFabClick 函数体缺失(锚点字符串变了?)');
} else {
    has(/e\.pointerType === 'touch'/, clickBody, 'C4', '触屏两段式只看本次 click 的 pointerType');
    has(/setEdgeOpen\(true\)/, clickBody, 'C4', '触屏首段只展开不开面板');
    has(/togglePanel\(\)/, clickBody, 'C4', '第二段/鼠标/键盘仍走原 togglePanel');
    if (/lastPointerType/.test(clickBody)) {
        fail('C4-FIX2', 'onFabClick 仍拿跨交互的 lastPointerType 兜底, 键盘会被误判成触屏首段');
    } else {
        ok('C4-FIX2', '两段式不读历史 pointerType(键盘 Enter/Space 直接开面板)');
    }
}
if (/lastPointerType/.test(src)) {
    fail('C4-FIX2', '源码仍残留 lastPointerType 跨交互指针类型记账');
}

const openBody = bodyOf('openPanel');
if (!openBody) fail('C4', 'openPanel 缺失(锚点字符串变了?)');
else has(/setEdgeOpen\(true\)/, openBody, 'C4', 'openPanel 加保持标记(showBatchDone 走同一路径)');
const closeBody = bodyOf('closePanel');
if (!closeBody) fail('C4', 'closePanel 缺失(锚点字符串变了?)');
else has(/maybeCollapseEdge\(\)/, closeBody, 'C4', 'closePanel 触发条件缩回判定');

// C4 输入源接线: 指针跟踪 / 触屏记账 / 失焦清理(失焦自动关闭链本身不动)
const clickAt = src.indexOf("fab.addEventListener('click', onFabClick);");
if (clickAt < 0) {
    fail('C4', 'fab click 未改走 onFabClick(触屏两段式不生效)');
} else {
    const inputTail = src.slice(clickAt - 400, clickAt + 1400);
    has(/fab\.addEventListener\('mouseenter'/, inputTail, 'C4', '指针进入命中区记账');
    has(/fab\.addEventListener\('mouseleave'/, inputTail, 'C4', '指针离开触发缩回判定');
    has(/document\.addEventListener\('pointerdown'/, inputTail, 'C4', '触屏首段点到 UI 之外时清理标记');
    has(/window\.addEventListener\('blur'/, inputTail, 'C4', '窗口失焦清理指针/触屏跟踪, 使关面板后能缩回');
}

// 修复 1: 批量取消出口补调 edge 重判; showBatchDone 仍走 openPanel 保持逻辑
if (!/UI\.recheckEdge\(\)/.test(src)) {
    fail('C4-FIX1', '批量取消路径 endBatch 后未补调 UI.recheckEdge(), .edge-open 会残留');
} else {
    ok('C4-FIX1', '批量取消后按四条件重判 edge 缩回');
}
if (!/recheckEdge:\s*maybeCollapseEdge/.test(src)) {
    fail('C4-FIX1', 'UI 未导出 recheckEdge(maybeCollapseEdge)');
}

// ---------- 版本 ----------
if (!quiet) console.log('版本. 脚本头 @version');

has(/\/\/\s*@version\s+2026\.11\.24\.5/, src, 'VER', '@version 为 2026.11.24.5');
if (/2026\.11\.24\.4/.test(src)) fail('VER', '源码仍残留旧版本号 2026.11.24.4');
else ok('VER', '无旧版本号 2026.11.24.2 残留');

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));

if (problems.length) {
    console.error(`\n[FAIL] 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 核对 edge 按钮独立类与监听、ptac_edge 读写、竖线四值与双锚点展开、面板 bottom:84px。');
    process.exit(1);
}
console.log('\n[PASS] FAB 靠边模式静态护栏通过(C1 / C2 / C3 / C4 + 边界)。');
