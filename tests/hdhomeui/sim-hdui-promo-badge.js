#!/usr/bin/env node
'use strict';
/**
 * 仿真: 促销徽章是**文字**而非图形(.29)
 * ------------------------------------------------------------------
 * 为什么单独一个用例:
 *   站点促销是 `<img class="pro_*">`(36×11 雪碧图)。`<img>` 是**替换元素、伪元素不渲染**,
 *   所以 `content:attr(alt)` 和 `::after{content:"免费"}` 都做不出来 —— 想显示"字"只能
 *   **把文字画进 SVG**。此前是 16×16 的图形徽章(prodown/proFree/pro2up),
 *   用户实拍反馈「Free 等促销标签图标不具辨识度」⇒ 改文字徽章。
 *
 * 覆盖:
 *   ① 三种已知促销的 content 是 SVG, 且**解码后含站点原文**(Free / 50% / 2X Free)
 *   ② 徽章宽度 > 0(P42: SVG 没固有尺寸时 img 会塌成 0 宽, 连累外层布局)
 *   ③ **未登记**的 pro_* 家族走「促销」文字兜底, 不能是空白(P66 / 用户提醒"不止这 3 个")
 *   ④ 三种颜色仍两两不同(.20 分色的成果不能被这次改回去)
 *
 * ⚠️ 判据: 只验"是 SVG"抓不到"字对不对" —— 必须**解码 data URI 再查文本**。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

/** 取促销 img 的 content → 解码成 SVG 源文, 再看里面有没有指定的字 */
// ⚠️ harness 的 eval 会把表达式包进 `(() => { ... })()`, 所以这里**不能再套一层 IIFE** ——
//    套了以后 `return out` 只返回到内层函数, 外层拿到 undefined(刚踩过)。
const PROBE = [
    'function decode(c) {',
    '  const m = /url\\("(.+)"\\)/.exec(String(c));',
    '  if (!m) return "";',
    '  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }',
    '}',
    'const out = {};',
    '["pro_free", "pro_50pctdown", "pro_free2up"].forEach(function (k) {',
    '  const e = document.querySelector("#torrenttable img." + k);',
    '  if (!e) { out[k] = null; return; }',
    '  const cs = getComputedStyle(e);',
    '  const r = e.getBoundingClientRect();',
    '  out[k] = { svgText: decode(cs.content), w: Math.round(r.width), h: Math.round(r.height),',
    '    isSvg: String(cs.content).indexOf("data:image/svg+xml") >= 0 };',
    '});',
    // 未登记家族: 仿真页 unknown 变体里有 pro_znewpromo
    'const un = document.querySelector("#torrenttable img.pro_znewpromo");',
    'if (un) {',
    '  const cs = getComputedStyle(un);',
    '  const r = un.getBoundingClientRect();',
    '  out.__unknown = { svgText: decode(cs.content), w: Math.round(r.width),',
    '    isSvg: String(cs.content).indexOf("data:image/svg+xml") >= 0 };',
    '}',
    'return out;'
].join('\n');

/** 站点原文(真站 img 的 alt, 见用户回传探针) */
const WANT = {
    pro_free: 'Free',
    pro_50pctdown: '50%',
    pro_free2up: '2X Free'
};

runCase('HDHomeUI · 促销徽章为文字且未登记家族有兜底(.29)', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'film' });

        // ================= ① ② ④ 三种已知促销 =================
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        const r = await page.eval(PROBE);

        Object.keys(WANT).forEach(function (k) {
            const v = r[k];
            assert(v && v.isSvg,
                '促销 ' + k + ' 的 content 是内联 SVG(实际: ' + JSON.stringify(v).slice(0, 120) + ')');
            // ⚠️ 核心: 解码后**含站点原文**。只验"是 SVG"的话, 换回图形徽章这条也不会红。
            assert(v && v.svgText.indexOf('>' + WANT[k] + '<') >= 0,
                '促销 ' + k + ' 的徽章**带文字**[' + WANT[k] + '](.29: 图形不具辨识度), SVG 片段: '
                + String(v && v.svgText).slice(-110));
            // P42: 没固有尺寸的 SVG 会让 img 塌成 0 宽
            assert(v && v.w > 0,
                '促销 ' + k + ' 的徽章宽度 > 0(P42: 否则 img 塌成 0 宽连累布局), 实际 ' + (v && v.w));
            assert(v && v.h > 0,
                '促销 ' + k + ' 的徽章高度 > 0, 实际 ' + (v && v.h));
        });

        // ④ 三色仍两两不同(.20 的成果不能回退)
        const hexes = Object.keys(r).filter(function (k) { return r[k]; }).map(function (k) {
            const m = /fill="(#[0-9a-fA-F]{6})"/.exec(r[k].svgText);
            return m ? m[1].toLowerCase() : null;
        });
        assertEq(new Set(hexes).size, hexes.length,
            '三种促销徽章颜色两两不同(.20), 实际 ' + JSON.stringify(hexes));
        await page.close();

        // ================= ③ 未登记家族的兜底 =================
        const p2 = await H.open(sim, 'hdhome-ui-unknown');
        await H.waitState(p2, 'applied');
        const r2 = await p2.eval(PROBE);
        assert(r2.__unknown,
            '仿真页存在未登记的促销家族 pro_znewpromo(否则兜底断言空跑)');
        assert(r2.__unknown.isSvg,
            '未登记促销家族的 content 仍是内联 SVG(P66: 不能变空白), 实际 '
            + JSON.stringify(r2.__unknown).slice(0, 120));
        assert(r2.__unknown.svgText.indexOf('>促销<') >= 0,
            '未登记促销家族走**文字兜底**「促销」(.29: 用户提醒不止 3 个标签), SVG 片段: '
            + String(r2.__unknown.svgText).slice(-110));
        assert(r2.__unknown.w > 0,
            '兜底徽章宽度 > 0, 实际 ' + r2.__unknown.w);
        await p2.close();
    }, { scriptPath: H.HDUI_PATH });
});
