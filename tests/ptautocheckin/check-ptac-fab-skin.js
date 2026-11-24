#!/usr/bin/env node
/*
 * check-ptac-fab-skin.js: FAB 皮肤精简(B1 / B2 / B3 / A3)的静态护栏(零依赖)
 *
 * 背景(2026.11.24, 计划 26-11-24-1409 §04 B1/B2/B3/A3):
 *   B1 皮肤条由 4 钮精简为 3 钮(chameleon / signal / static), 删 number 与 ring;
 *   B2 applyFabSkin 增 static 分支 = 变色语义 + .static 关停全部动画;
 *   B3 legacy ptac_skin=number|ring 在 applyFabSkin 入口内存归一为 chameleon,
 *      渲染与皮肤条高亮都用归一值, GM 存储值原样保留不回写;
 *   A3 同步清掉 numPulse / ringBreathe / rayPulse / .ring-rays / --ring-grad
 *      与 number/ring 两个分支。
 *
 * 校验内容(全部只读源文件, 不执行):
 *   B1 皮肤条类名为 skin-btn 的按钮恰 3 个, data-skin 集合精确等于三项;
 *   B2 存在 case 'static', 其落到 default 的变色渲染, 且有两条关停动画的 CSS;
 *   B3 viewSkin 归一同时覆盖 number 与 ring, switch 与高亮都用 viewSkin,
 *      applyFabSkin 内不出现 gmSet(不回写);
 *   A3 全文无 numPulse / ringBreathe / rayPulse / ring-rays / ring-grad,
 *      无 case 'number' / case 'ring', 无 number/ring 皮肤钮。
 *
 * 用法:
 *   node tests/ptautocheckin/check-ptac-fab-skin.js
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

if (!fs.existsSync(SRC)) {
    console.error(`找不到源文件: ${SRC}`);
    process.exit(2);
}
const src = fs.readFileSync(SRC, 'utf8');

// 取 applyFabSkin 函数体(到紧随其后的 setFabBadge 为止, 不解析嵌套括号)
function applyBody() {
    const a = src.indexOf('function applyFabSkin(');
    const b = src.indexOf('function setFabBadge(', a);
    if (a < 0 || b < 0) return '';
    return src.slice(a, b);
}

// 取 case 'static' 到 default: 之间的源码片段, 用控制流而非字符窗口判断贯通
function staticFallthrough(body) {
    const a = body.indexOf("case 'static'");
    if (a < 0) return null;
    const b = body.indexOf('default:', a);
    if (b < 0) return null;
    return body.slice(a, b);
}

if (!quiet) {
    console.log('PTAutoCheckIn FAB 皮肤精简静态护栏校验');
    console.log('='.repeat(72));
}

// ---------- B1. 皮肤条 3 钮 ----------
if (!quiet) console.log('B1. 皮肤条 3 钮与 data-skin 集合');

const skinBtnCount = (src.match(/class="skin-btn"/g) || []).length;
if (skinBtnCount === 3) ok('B1', '皮肤条恰 3 个 skin-btn');
else fail('B1', `皮肤条 skin-btn 数应为 3, 实际 ${skinBtnCount}`);

const skins = Array.from(src.matchAll(/data-skin="([^"]+)"/g)).map((m) => m[1]).sort();
const expectedSkins = ['chameleon', 'signal', 'static'];
if (JSON.stringify(skins) === JSON.stringify(expectedSkins)) {
    ok('B1', 'data-skin 集合精确匹配 chameleon / signal / static');
} else {
    fail('B1', `data-skin 集合应为 ["chameleon","signal","static"], 实际 ${JSON.stringify(skins)}`);
}

// ---------- B2. static 分支与动画关停 ----------
if (!quiet) console.log('B2. static 分支 = 变色语义 + 关停动画');

const body = applyBody();
if (!body) {
    fail('B0', 'applyFabSkin 函数体缺失(锚点字符串变了?)');
} else {
    has(/case\s+'static'/, body, 'B2', "applyFabSkin 存在 case 'static'");
    const fall = staticFallthrough(body);
    if (fall === null) {
        fail('B2', "未找到 case 'static' 到 default: 的贯通路径");
    } else if (/\b(break|return)\b/.test(fall)) {
        fail('B2', 'static 分支出现 break/return, 未贯穿到 default 的变色渲染');
    } else {
        ok('B2', 'static 分支无 break/return, 贯穿到 default 的变色渲染(逐态一致)');
    }
    has(/default:\s*\{[\s\S]{0,200}?fab\.classList\.add\('chameleon'\)/, body, 'B2', 'default 走变色语义(加 .chameleon)');
    has(/fab\.classList\.remove\([^\n]*'static'[^\n]*\)/, body, 'B2', '清类白名单含 static');

    // ---------- B3. legacy 内存归一(渲染 + 高亮 + 不回写) ----------
    if (!quiet) console.log('B3. legacy number/ring 内存归一');
    has(/const\s+viewSkin\s*=\s*\(skin\s*===\s*'number'\s*\|\|\s*skin\s*===\s*'ring'\)\s*\?\s*'chameleon'\s*:\s*skin/,
        body, 'B3', 'viewSkin 把 number 与 ring 都归一为 chameleon');
    has(/switch\s*\(\s*viewSkin\s*\)/, body, 'B3', 'switch 使用归一后的 viewSkin');
    has(/b\.dataset\.skin\s*===\s*viewSkin/, body, 'B3', '皮肤条高亮使用 viewSkin(legacy 高亮落变色钮)');
    if (/b\.dataset\.skin\s*===\s*skin\b/.test(body)) {
        fail('B3', '皮肤条高亮仍使用未归一的 skin');
    } else {
        ok('B3', '高亮未使用未归一的 skin');
    }
    if (/gmSet\s*\(/.test(body)) {
        fail('B3', 'applyFabSkin 内出现 gmSet, 违反 GM 值不回写约束');
    } else {
        ok('B3', 'applyFabSkin 内无 gmSet, GM legacy 值原样保留');
    }
}

has(/\.fab\.static\s*\{\s*animation:\s*none\s*!important;\s*\}/, src, 'B2', '.fab.static 关本体全部动画');
has(/\.fab\.static::after\s*\{\s*animation:\s*none\s*!important;\s*\}/, src, 'B2', '.fab.static::after 关辉光动画');

// ---------- A3. ring/number 残留清理 ----------
if (!quiet) console.log('A3. ring/number 残留标记清理');

const residue = /numPulse|ringBreathe|rayPulse|ring-rays|ring-grad/.exec(src);
if (residue) fail('A3', `全文残留标记 ${residue[0]}`);
else ok('A3', '全文无 numPulse / ringBreathe / rayPulse / ring-rays / ring-grad');

if (/case\s+'(number|ring)'/.test(src)) fail('A3', "残留 case 'number' 或 case 'ring'");
else ok('A3', '无 case number / case ring 分支');

if (/data-skin="(number|ring)"/.test(src)) fail('B1', '残留 number/ring 皮肤条按钮');
else ok('B1', '无 number/ring 皮肤条按钮');

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));

if (problems.length) {
    console.error(`\n[FAIL] 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 检查皮肤条 3 钮、static 分支落点、viewSkin 归一覆盖高亮、ring/number 残留清理。');
    process.exit(1);
}
console.log('\n[PASS] FAB 皮肤精简护栏通过(B1 / B2 / B3 / A3)。');
