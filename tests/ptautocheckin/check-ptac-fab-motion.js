#!/usr/bin/env node
/*
 * check-ptac-fab-motion.js: FAB 动效开关(A2 / A3)的静态护栏(零依赖)
 *
 * 背景(2026.11.24, 计划 26-11-24-2226 §04 A2/A3, §06 D1/D2/D8):
 *   A2 新增 GM 键 ptac_motion; 皮肤条加 data-motion 布尔开关(文案「动效」/「静态」),
 *      与靠边开关并列并以细分隔线隔开; 初始化读 GM(默认开), 点击切开关并持久化;
 *   A3 关动效 = host 挂 .motion-off, shadow 内用 :host(.motion-off) 停掉
 *      .fab / .fab::after / .fab.chameleon 三类 animation; ptacHlPulse(签到按钮高亮)
 *      属签到逻辑, 必须原样保留(§06 D1);
 *   A4 legacy static 读到时动效开关初始化为关, GM 原值不回写(§06 D8)。
 *
 * 校验内容(全部只读源文件, 不执行):
 *   A2 K 表含 motion: 'ptac_motion'; init 用 gmGet(K.motion, true) 默认开;
 *      motionBtn 独立取用 / 独立监听 / 独立 aria-pressed; setMotion 用
 *      gmSet(K.motion, motionOn) 持久化且不碰皮肤/靠边; syncMotionButton 同步两处文案;
 *      初始化路径只读 GM 不回写; data-motion 按钮绝不带 skin-btn 类;
 *   A3 CSS 三选择器均 animation:none!important(用 :host 形式穿透 closed shadow);
 *      ptacHlPulse 规则与 @keyframes 仍在, 且不在关停选择器内;
 *   A4 init 读 legacy static 时把动效内存标志置关, 不写回 K.motion;
 *   版本 @version 2026.11.24.5。
 *
 * 用法:
 *   node tests/ptautocheckin/check-ptac-fab-motion.js
 *   node tests/run-all.js
 *
 * 注: 开发期校验工具(tests/ 下, 非 userscript), 无 @version 头, 不参与 @version 铁律。
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
function hasNone(re, text, code, msg) {
    if (!re.test(text)) { ok(code, msg); return true; }
    fail(code, msg);
    return false;
}

if (!fs.existsSync(SRC)) {
    console.error(`找不到源文件: ${SRC}`);
    process.exit(2);
}
const src = fs.readFileSync(SRC, 'utf8');

// 取 const K = { ... } 块
function kBlock() {
    const a = src.indexOf('const K = {');
    if (a < 0) return '';
    const b = src.indexOf('\n};', a);
    return b < 0 ? '' : src.slice(a, b);
}

// 取具名函数的整块(大括号配平)
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

if (!quiet) {
    console.log('PTAutoCheckIn FAB 动效开关静态护栏校验');
    console.log('='.repeat(72));
}

// ---------- A2. GM 键与初始化 ----------
if (!quiet) console.log('A2. GM 键 ptac_motion 与默认开初始化');

const K = kBlock();
if (!K) fail('A2', 'const K = { ... } 块缺失(锚点字符串变了?)');
else has(/\bmotion:\s*'ptac_motion'/, K, 'A2', "K 表含 motion: 'ptac_motion'");

has(/motionOn\s*=\s*gmGet\(K\.motion,\s*true\)/, src, 'A2', 'init 用 gmGet(K.motion, true) 初始化(默认开)');

// init 动效恢复路径: 只读 GM + 同步 host 类, 绝不写回(legacy static 改内存标志也属此路径)
const motionInitAt = src.indexOf('motionOn = gmGet(K.motion, true);');
const motionInitTail = motionInitAt < 0 ? '' : src.slice(motionInitAt, motionInitAt + 300);
if (!motionInitTail) fail('A2', '未找到动效 GM 读取语句');
else {
    has(/host\.classList\.toggle\('motion-off',\s*!motionOn\)/, motionInitTail, 'A2', 'init 按内存标志同步 host 的 .motion-off');
    hasNone(/gmSet\s*\(/, motionInitTail, 'A2', 'init 恢复只读 GM, 不回写 ptac_motion');
}

// ---------- A2. 开关按钮独立性 ----------
if (!quiet) console.log('A2. data-motion 开关与靠边开关并列且各自独立');

const motionBtnMatch = /<button\b[^>]*\bdata-motion\b[^>]*>/.exec(src);
if (!motionBtnMatch) {
    fail('A2', '未找到带 data-motion 的 button 标签');
} else {
    const tag = motionBtnMatch[0];
    if (/class="motion-btn"/.test(tag)) ok('A2', '动效按钮带独立类 motion-btn');
    else fail('A2', '动效按钮缺独立类 motion-btn');
    if (/\bskin-btn\b/.test(tag)) fail('A2', '严重: 动效按钮带 skin-btn 类, 会被单选数组收编并误调 setSkin(undefined)');
    else ok('A2', '动效按钮绝不带 skin-btn 类(不被 querySelectorAll(".skin-btn") 收编)');
    if (/aria-pressed=/.test(tag)) ok('A2', '动效按钮用独立 aria-pressed 表达布尔态');
    else fail('A2', '动效按钮缺 aria-pressed 布尔态标记');
    // 文案节点在按钮内层(> 之后的 span), 取按钮连同内层的窗口判断
    const motionBtnAt = src.indexOf(tag);
    const motionBtnWindow = src.slice(motionBtnAt, motionBtnAt + tag.length + 100);
    if (/class="motion-label"/.test(motionBtnWindow)) ok('A2', '动效按钮有独立文案节点 .motion-label');
    else fail('A2', '动效按钮缺 .motion-label 文案节点');
}

const sepCount = (src.match(/class="edge-sep"/g) || []).length;
if (sepCount >= 2) ok('A2', `两个布尔开关间有细分隔线(edge-sep 数 ${sepCount})`);
else fail('A2', `需至少 2 条 edge-sep 分隔皮肤单选与两个布尔开关, 实际 ${sepCount}`);

has(/motionBtn\s*=\s*panel\.querySelector\('\.motion-btn'\)/, src, 'A2', '动效按钮独立 querySelector');
has(/motionBtn\.addEventListener\('click'/, src, 'A2', '动效按钮独立 addEventListener');
const motionInitBtnAt = src.indexOf("motionBtn = panel.querySelector('.motion-btn');");
const motionInitBtnTail = motionInitBtnAt < 0 ? '' : src.slice(motionInitBtnAt, motionInitBtnAt + 220);
if (!motionInitBtnTail) fail('A2', '未找到 motionBtn 赋值语句');
else has(/syncMotionButton\(\)/, motionInitBtnTail, 'A2', 'motionBtn 赋值后立即同步初始化按钮 UI');

const syncMotion = bodyOf('syncMotionButton');
if (!syncMotion) fail('A2', 'syncMotionButton 函数体缺失(锚点字符串变了?)');
else {
    has(/motionBtn\.setAttribute\('aria-pressed'/, syncMotion, 'A2', 'syncMotionButton 同步 aria-pressed');
    has(/\.motion-label'\)\.textContent\s*=\s*motionOn\s*\?\s*'动效'\s*:\s*'静态'/, syncMotion,
        'A2', 'syncMotionButton 同步「动效」/「静态」文案');
}

const setMotion = bodyOf('setMotion');
if (!setMotion) fail('A2', 'setMotion 函数体缺失(锚点字符串变了?)');
else {
    has(/motionOn\s*=\s*!!on/, setMotion, 'A2', 'setMotion 写入布尔态');
    has(/gmSet\(K\.motion,\s*motionOn\)/, setMotion, 'A2', 'setMotion 用 gmSet(K.motion, motionOn) 持久化');
    has(/syncMotionButton\(\)/, setMotion, 'A2', 'setMotion 调用 syncMotionButton(按钮 UI 单一来源)');
    hasNone(/setSkin\s*\(|render\s*\(|setEdge\s*\(/, setMotion, 'A2', 'setMotion 不碰皮肤渲染与靠边开关(正交)');
    hasNone(/aria-pressed|motion-label/, setMotion, 'A2', 'setMotion 不内联按钮 UI(避免两套文案漂移)');
}

// ---------- A4. legacy static 静默迁移 ----------
if (!quiet) console.log('A4. legacy static 动效关且 GM 不回写');

const legacyAt = src.indexOf("if (skin === 'static') motionOn = false;");
if (legacyAt < 0) {
    fail('A4', '未找到 legacy static 置动效关的语句');
} else {
    ok('A4', '读到 legacy static 时把动效内存标志置关');
    hasNone(/gmSet\s*\(/, src.slice(legacyAt, legacyAt + 120), 'A4', 'legacy static 分支不回写 GM 原值');
}

// ---------- A3. 关动效 CSS 与签到逻辑隔离 ----------
if (!quiet) console.log('A3. .motion-off 停三类动画, ptacHlPulse 保留');

// 取从第一条 :host(.motion-off) 起到规则右大括号的整块
const motionCssAt = src.indexOf(':host(.motion-off) .fab,');
const motionCss = motionCssAt < 0 ? '' : (() => {
    const brace = src.indexOf('{', motionCssAt);
    const end = src.indexOf('}', brace);
    return brace < 0 || end < 0 ? '' : src.slice(motionCssAt, end + 1);
})();
if (!motionCss) {
    fail('A3', ':host(.motion-off) 动画关停规则缺失(锚点字符串变了?)');
} else {
    has(/:host\(\.motion-off\)\s*\.fab\s*,/, motionCss, 'A3', '关停 .fab 本体动画(变色形变)');
    has(/:host\(\.motion-off\)\s*\.fab::after\s*,/, motionCss, 'A3', '关停 .fab::after 辉光动画');
    has(/:host\(\.motion-off\)\s*\.fab\.chameleon\s*\{/, motionCss, 'A3', '关停 .fab.chameleon 形变动画');
    has(/animation:\s*none\s*!important/, motionCss, 'A3', '三类动画均 animation:none!important');
    hasNone(/ptacHlPulse/, motionCss, 'A3', '关停规则不覆盖 ptacHlPulse(签到按钮高亮)');
}

has(/@keyframes\s+ptacHlPulse\s*\{/, src, 'A3', '@keyframes ptacHlPulse 仍在(签到逻辑零改动)');
has(/animation:\s*ptacHlPulse\s+1\.8s/, src, 'A3', '签到按钮高亮动画规则仍在');

// ---------- 版本 ----------
if (!quiet) console.log('版本. 脚本头 @version');

has(/\/\/\s*@version\s+2026\.11\.24\.5/, src, 'VER', '@version 为 2026.11.24.5');
hasNone(/2026\.11\.24\.4/, src, 'VER', '源码无旧版本号 2026.11.24.4 残留');

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));

if (problems.length) {
    console.error(`\n[FAIL] 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 核对 ptac_motion 读写、data-motion 按钮独立接线、:host(.motion-off) 三类动画关停与 ptacHlPulse 保留。');
    process.exit(1);
}
console.log('\n[PASS] FAB 动效开关静态护栏通过(A2 / A3 / A4)。');
