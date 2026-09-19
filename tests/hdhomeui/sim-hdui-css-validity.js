#!/usr/bin/env node
'use strict';
/**
 * 仿真: 生成的 CSS 无「静默失败」
 * ------------------------------------------------------------------
 * 为什么单独一个用例:
 *   本主题是**纯 CSS 层** —— 全部效果都靠往 `style#hdui-css` 里塞规则实现。
 *   而 CSS 的失败是**完全无声**的: 选择器或值写错, 浏览器把整条规则丢掉,
 *   既不报错也不渲染, 页面上看不出少了一条, 前面几轮加的四档扫描(漏白 / 小件近白 /
 *   残留装饰 / 对比度)看的是**渲染结果**, 也照样发现不了"这条规则根本没生效"。
 *
 *   典型例子: `TN_META + '{flex:0 0 auto'` 少一个 `}`、`:nth-child(undefined)`、
 *   `content:url(...)` 里 SVG 没转义 —— 都是"写的时候看不出来、跑起来才发现没变化"。
 *
 * 做法: 把 `style#hdui-css` 的文本按顶层 `{}` 切成一条条, 逐条喂给一个临时 <style>,
 *       用 CSSOM 的 `cssRules.length` 判断它**有没有被解析**; 被丢弃的把原文报出来。
 *       (CSSOM 会直接丢掉无法解析的规则, 所以"切出来 N 条"与"解析出 M 条"的差就是死规则。)
 *
 * 覆盖:
 *   ① 切成 N 条 → 解析出 N 条, 被丢弃 0 条
 *   ② 规则数不至于少得离谱(防止 CSS 根本没生成 / 生成到一半)
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/** 逐条喂给 CSSOM, 看哪些被丢弃 */
const CSS_PROBE = [
    'const st = document.getElementById("hdui-css");',
    'if (!st) return { err: "找不到 style#hdui-css" };',
    'const txt = st.textContent;',
    'const chunks = [];',
    'let depth = 0, buf = "";',
    'for (let i = 0; i < txt.length; i++) {',
    '  const c = txt[i];',
    '  if (c === "{") { depth++; buf += c; }',
    '  else if (c === "}") { depth--; buf += c;',
    '    if (depth <= 0) { if (buf.trim()) chunks.push(buf.trim()); buf = ""; depth = 0; } }',
    '  else if (depth === 0 && c === ";") { if (buf.trim()) chunks.push(buf.trim()); buf = ""; }',
    '  else buf += c;',
    '}',
    'const dead = [];',
    'const probe = document.createElement("style");',
    'document.head.appendChild(probe);',
    'chunks.forEach(function (r) {',
    '  probe.textContent = r;',
    '  const n = probe.sheet ? probe.sheet.cssRules.length : -1;',
    '  if (n <= 0) dead.push(r.slice(0, 140));',
    '});',
    'probe.remove();',
    'return { total: chunks.length, parsed: st.sheet ? st.sheet.cssRules.length : -1,',
    '  dead: dead.slice(0, 8), deadN: dead.length, bytes: txt.length };'
].join('\n');

runCase('HDHomeUI · 生成的 CSS 无静默失败（逐条过 CSSOM）', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');

        const r = await page.eval(CSS_PROBE);
        assert(!r.err, '取到 style#hdui-css' + (r.err ? '(' + r.err + ')' : ''));
        assert(r.total > 60, '生成的规则数 ' + r.total + ' > 60(防止 CSS 根本没生成/生成到一半)');

        // ① 切成 N 条就必须解析出 N 条 —— 差多少就是多少条被浏览器静默丢掉
        assertEq(r.deadN, 0,
            '无一条规则被浏览器丢弃(共 ' + r.total + ' 条); 丢弃的规则: '
            + JSON.stringify(r.dead));
        assertEq(r.parsed, r.total,
            'CSSOM 解析出 ' + r.parsed + ' 条 = 切出的 ' + r.total + ' 条');

        // ② 体积: 全是内联 SVG, 但按"每条选择器一张"生成, 不该随行数膨胀。
        //    真站 100 行实测 ~180KB; 这里给个宽松上限, 防止有人改成"逐行生成"把 CSS 撑爆。
        assert(r.bytes < 400000,
            'CSS 体积 ' + Math.round(r.bytes / 1024) + 'KB < 400KB(图标按选择器生成, 不该随行数膨胀)');
        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
