#!/usr/bin/env node
/*
 * check-ptac-fab-anim.js: PTAutoCheckIn FAB 三条 infinite 动画的合成属性护栏(零依赖)
 *
 * 背景(2026.11.24, 计划 26-11-24-1409 A1/A2):
 *   上一轮定位静息 CPU 高占用根因 = FAB 的 infinite 动画逐帧改非合成属性,
 *   触发 Recalculate Style -> Pre-Paint -> Paint -> Composite 全链路重绘:
 *     A1 baseGlow / stateGlow 原逐帧改 box-shadow; 现改为预渲染光晕伪元素(::after)常驻辉光,
 *        @keyframes 只动 opacity(合成属性);
 *     A2 chameleonWave 原逐帧改 transform + border-radius; 现只留 transform(合成属性).
 *
 * 为什么只读这三个 keyframes 块: 本批(W1)只做 A1/A2, A3(随删 number/ring 清 numPulse /
 *   ringBreathe / rayPulse)尚未实施, 故不能做全局断言; 断言范围严格限定这三个块.
 *
 * 校验内容:
 *   A1 baseGlow / stateGlow 块内不得出现 box-shadow / border-radius / filter, 且必须有 opacity;
 *   A2 chameleonWave 块内不得出现 box-shadow / border-radius / filter, 且必须有 transform.
 *
 * 用法:
 *   node tests/ptautocheckin/check-ptac-fab-anim.js           # 校验, 有问题 exit 1
 *   node tests/ptautocheckin/check-ptac-fab-anim.js --quiet   # 只输出失败项
 *   node tests/run-all.js                                    # 跑全部测试(本文件是其中之一)
 *
 * 注: 开发期校验工具(tests/ 下, 非 userscript), 无 @version 头, 不参与 @version 铁律; 只读源文件.
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

// 切出某个具名 @keyframes 的整块(大括号配平, 不解析 CSS 语法; 只认顶层的 @keyframes NAME {)
function keyframesOf(name) {
    const head = src.indexOf(`@keyframes ${name} {`);
    if (head < 0) return '';
    const firstBrace = src.indexOf('{', head);
    if (firstBrace < 0) return '';
    let depth = 0;
    for (let i = firstBrace; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return src.slice(head, i + 1);
        }
    }
    return '';
}

if (!quiet) {
    console.log('PTAutoCheckIn FAB 动画合成属性护栏校验');
    console.log('='.repeat(72));
}

// ---------- A1. 辉光呼吸: baseGlow / stateGlow 只动 opacity ----------
if (!quiet) console.log('A1. 辉光呼吸(预渲染光晕伪元素 + opacity)');

const baseGlow = keyframesOf('baseGlow');
const stateGlow = keyframesOf('stateGlow');

if (!baseGlow || !stateGlow) {
    fail('A0', 'baseGlow / stateGlow 中有 @keyframes 块缺失(锚点字符串变了?)');
} else {
    has(/opacity\s*:/, baseGlow, 'A1', 'baseGlow 通过 opacity 呼吸(合成属性)');
    has(/opacity\s*:/, stateGlow, 'A1', 'stateGlow 通过 opacity 呼吸(合成属性)');
    if (/box-shadow|border-radius|filter/.test(baseGlow)) {
        fail('A1', 'baseGlow 块内出现非合成属性(box-shadow / border-radius / filter)');
    } else {
        ok('A1', 'baseGlow 块内无非合成属性');
    }
    if (/box-shadow|border-radius|filter/.test(stateGlow)) {
        fail('A1', 'stateGlow 块内出现非合成属性(box-shadow / border-radius / filter)');
    } else {
        ok('A1', 'stateGlow 块内无非合成属性');
    }
}

// ---------- A2. 变色形变: chameleonWave 只动 transform ----------
if (!quiet) console.log('A2. 变色形变(仅 transform 合成属性)');

const wave = keyframesOf('chameleonWave');

if (!wave) {
    fail('A0', 'chameleonWave 的 @keyframes 块缺失(锚点字符串变了?)');
} else {
    has(/transform\s*:/, wave, 'A2', 'chameleonWave 通过 transform 形变(合成属性)');
    if (/box-shadow|border-radius|filter/.test(wave)) {
        fail('A2', 'chameleonWave 块内出现非合成属性(box-shadow / border-radius / filter)');
    } else {
        ok('A2', 'chameleonWave 块内无非合成属性');
    }
}

// ---------- 汇总 ----------
if (!quiet) console.log('-'.repeat(72));

if (problems.length) {
    console.error(`\n\u2718 校验未通过, ${problems.length} 项问题:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\n修复方向: 辉光呼吸的 box-shadow 挪到 ::after 预渲染, keyframes 只留 opacity;');
    console.error('变色形变去掉 border-radius 关键帧, 只留 transform。');
    process.exit(1);
}
console.log('\n\u2714 FAB 动画合成属性护栏通过(baseGlow / stateGlow / chameleonWave)。');
