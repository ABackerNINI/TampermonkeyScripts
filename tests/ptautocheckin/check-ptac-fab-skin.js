#!/usr/bin/env node
/*
 * check-ptac-fab-skin.js: FAB 皮肤条(2 钮)与 legacy 静默归一的静态护栏(零依赖)
 *
 * 背景(2026.11.24, 计划 26-11-24-2226 §04 A1/A4):
 *   A1 删 static 皮肤: 皮肤条回归 2 钮(chameleon / signal), 删 .fab.static 两规则、
 *      皮肤枚举注释与 applyFabSkin 的 case 'static'; 关动效改由 data-motion 布尔开关承载
 *      (其接线见 check-ptac-fab-motion.js);
 *   A4 legacy 归一: static 加入 number/ring 的归一列表 → 一律 chameleon 渲染 +
 *      变色钮高亮, GM 原值不回写; 若读到 legacy static, 动效开关初始化为关(由 motion 用例钉死)。
 *   原 3 钮 + static 分支断言(B1/B2/B3)随本批失效, 本件改钉新事实。
 *
 * 校验内容(全部只读源文件, 不执行):
 *   A1 皮肤条 skin-btn 恰 2 个, data-skin 集合精确为 chameleon/signal;
 *      全文无 data-skin="static" / fab.static / case 'static';
 *   A4 viewSkin 归一覆盖 static|number|ring, switch 与皮肤条高亮都用 viewSkin,
 *      applyFabSkin 内无 gmSet(不回写);
 *   残留: 无 numPulse / ringBreathe / rayPulse / ring-rays / ring-grad, 无 case number/ring。
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

// 取 applyFabSkin 函数体(到紧随其后的 setFabBadge 为止, 不解析嵌套括号)
function applyBody() {
    const a = src.indexOf('function applyFabSkin(');
    const b = src.indexOf('function setFabBadge(', a);
    if (a < 0 || b < 0) return '';
    return src.slice(a, b);
}

if (!quiet) {
    console.log('PTAutoCheckIn FAB 皮肤 2 钮与 legacy 归一静态护栏校验');
    console.log('='.repeat(72));
}

// ---------- A1. 皮肤条 2 钮 ----------
if (!quiet) console.log('A1. 皮肤条 2 钮与 data-skin 集合');

const skinBtnCount = (src.match(/class="skin-btn"/g) || []).length;
if (skinBtnCount === 2) ok('A1', '皮肤条恰 2 个 skin-btn');
else fail('A1', `皮肤条 skin-btn 数应为 2, 实际 ${skinBtnCount}`);

const skins = Array.from(src.matchAll(/data-skin="([^"]+)"/g)).map((m) => m[1]).sort();
const expectedSkins = ['chameleon', 'signal'];
if (JSON.stringify(skins) === JSON.stringify(expectedSkins)) {
    ok('A1', 'data-skin 集合精确匹配 chameleon / signal');
} else {
    fail('A1', `data-skin 集合应为 ["chameleon","signal"], 实际 ${JSON.stringify(skins)}`);
}

hasNone(/data-skin="static"/, src, 'A1', '无 data-skin="static" 皮肤按钮');
hasNone(/fab\.static/, src, 'A1', '全文无 fab.static 关停动画规则');
hasNone(/case\s+'static'/, src, 'A1', "applyFabSkin 无 case 'static' 分支");

// ---------- A4. legacy 内存归一(渲染 + 高亮 + 不回写) ----------
if (!quiet) console.log('A4. legacy static/number/ring 内存归一');

const body = applyBody();
if (!body) {
    fail('A0', 'applyFabSkin 函数体缺失(锚点字符串变了?)');
} else {
    has(/const\s+viewSkin\s*=[\s\S]{0,160}?skin\s*===\s*'static'[\s\S]{0,80}?skin\s*===\s*'number'[\s\S]{0,80}?skin\s*===\s*'ring'[\s\S]{0,120}?'chameleon'/,
        body, 'A4', 'viewSkin 把 static / number / ring 都归一为 chameleon');
    has(/switch\s*\(\s*viewSkin\s*\)/, body, 'A4', 'switch 使用归一后的 viewSkin');
    has(/default:\s*\{[\s\S]{0,200}?fab\.classList\.add\('chameleon'\)/, body, 'A4', 'default 走变色语义(加 .chameleon)');
    has(/b\.dataset\.skin\s*===\s*viewSkin/, body, 'A4', '皮肤条高亮使用 viewSkin(legacy 高亮落变色钮)');
    if (/b\.dataset\.skin\s*===\s*skin\b/.test(body)) {
        fail('A4', '皮肤条高亮仍使用未归一的 skin');
    } else {
        ok('A4', '高亮未使用未归一的 skin');
    }
    if (/gmSet\s*\(/.test(body)) {
        fail('A4', 'applyFabSkin 内出现 gmSet, 违反 GM 值不回写约束');
    } else {
        ok('A4', 'applyFabSkin 内无 gmSet, GM legacy 值原样保留');
    }
}

// ---------- 残留清理 ----------
if (!quiet) console.log('残留. ring/number 实现标记清理');

hasNone(/numPulse|ringBreathe|rayPulse|ring-rays|ring-grad/, src, '残留',
    '全文无 numPulse / ringBreathe / rayPulse / ring-rays / ring-grad');
hasNone(/case\s+'(number|ring)'/, src, '残留', "无 case 'number' / case 'ring' 分支");
hasNone(/data-skin="(number|ring|static)"/, src, '残留', '无 number/ring/static 皮肤条按钮');

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));

if (problems.length) {
    console.error(`\n[FAIL] 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 皮肤条 2 钮、无 static 残留、viewSkin 归一覆盖 static/number/ring 且不回写。');
    process.exit(1);
}
console.log('\n[PASS] FAB 皮肤 2 钮与 legacy 归一护栏通过(A1 / A4 + 残留清理)。');
