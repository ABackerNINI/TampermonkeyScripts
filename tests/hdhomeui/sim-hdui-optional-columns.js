#!/usr/bin/env node
'use strict';
/**
 * 仿真: A / A·GB 是别的脚本注入的列 —— 有或没有都要能上妆, 补进来要自动重摆
 * ------------------------------------------------------------------
 * 背景(用户实测): 那两列由外部脚本注入, 注入时机比本脚本晚。旧版把 12 列当硬性契约,
 * 那个瞬间就判 E_COLUMN_UNKNOWN → 弹红横幅回退; 用户点「重新尝试」时列已经在了, 于是成功。
 * 这个用例把「时序」钉死成可验证的事实:
 *   1. 只有 10 列(外部脚本没注入) —— 照常上妆, 不回退、不弹横幅, 且列映射跟着变
 *   2. 之后外部脚本把两列补进来 —— 自动重摆, 补进来的格子要吃到主题样式(证明 nth-child 重新对齐)
 *   3. 反过来把两列撤走 —— 同样不回退
 *   4. 补列补到一半(只补表头) —— 不得立刻弹横幅, 等窗口内自行恢复
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');
const PAGE = require('../lib/sim/hdhome-ui-page');

const CALC_HEAD = PAGE.calcHeadCells();
const CALC_ROW = PAGE.calcRowCells(40);

/** 外部脚本补列: 表头与每个数据行都在「发布者」之前插两格 */
const INJECT = [
    'const t = document.getElementById("torrenttable");',
    'const tb = t.tBodies[0];',
    'const head = tb.rows[0];',
    'const hLast = head.cells[head.cells.length - 1];',
    'hLast.insertAdjacentHTML("beforebegin", ' + JSON.stringify(CALC_HEAD) + ');',
    'for (let i = 1; i < tb.rows.length; i++) {',
    '  const r = tb.rows[i];',
    '  r.cells[r.cells.length - 1].insertAdjacentHTML("beforebegin", ' + JSON.stringify(CALC_ROW) + ');',
    '}',
    'return { head: head.cells.length, row: tb.rows[1].cells.length };'
].join('\n');

/** 只补数据行(表头已补过): 把"补到一半"补完 */
const INJECT_ROW_ONLY = [
    'const t = document.getElementById("torrenttable");',
    'const tb = t.tBodies[0];',
    'for (let i = 1; i < tb.rows.length; i++) {',
    '  const r = tb.rows[i];',
    '  r.cells[r.cells.length - 1].insertAdjacentHTML("beforebegin", ' + JSON.stringify(CALC_ROW) + ');',
    '}',
    'return { head: tb.rows[0].cells.length, row: tb.rows[1].cells.length };'
].join('\n');

/** 只补表头不补数据行 —— 复现"补到一半"的瞬间(旧版此刻就会弹横幅) */
const INJECT_HEAD_ONLY = [
    'const t = document.getElementById("torrenttable");',
    'const tb = t.tBodies[0];',
    'const head = tb.rows[0];',
    'head.cells[head.cells.length - 1].insertAdjacentHTML("beforebegin", ' + JSON.stringify(CALC_HEAD) + ');',
    'return { head: head.cells.length, row: tb.rows[1].cells.length };'
].join('\n');

/** 把 A / A·GB 两列撤走 */
const REMOVE = [
    'const t = document.getElementById("torrenttable");',
    'const tb = t.tBodies[0];',
    'const head = tb.rows[0];',
    'head.removeChild(document.getElementById("calcTHeadA"));',
    'head.removeChild(document.getElementById("calcTHeadAve"));',
    'for (let i = 1; i < tb.rows.length; i++) {',
    '  const r = tb.rows[i];',
    '  const a = r.querySelector("[data-calc-a]");',
    '  const v = r.querySelector("[data-calc-ave]");',
    '  if (a) r.removeChild(a);',
    '  if (v) r.removeChild(v.parentNode.tagName === "TD" ? v.parentNode : v);',
    '}',
    'return { head: head.cells.length, row: tb.rows[1].cells.length };'
].join('\n');

function bannerVisible(page) {
    return page.eval('return !!document.getElementById("hdui-alert");');
}

/** 某一格的 ::before 内容(旧主题用它在数据格上挂「标签」; 胶片墙把栏名放在表头, 数据格不挂) */
function cellBefore(page, index) {
    return page.eval([
        'const t = document.getElementById("torrenttable");',
        'const row = t.tBodies[0].rows[1];',
        'const c = row.cells[' + index + '];',
        'if (!c) return null;',
        'return { text: (c.textContent || "").trim().slice(0, 12),',
        '  before: getComputedStyle(c, "::before").content,',
        '  font: getComputedStyle(c).fontFamily };'
    ].join('\n'));
}

function shape(page) {
    return page.eval([
        'const t = document.getElementById("torrenttable");',
        'const tb = t.tBodies[0];',
        'return { head: tb.rows[0].cells.length, row: tb.rows[1].cells.length,',
        '  hasCalc: !!document.getElementById("calcTHeadA") };'
    ].join('\n'));
}

runCase('HDHomeUI · A/A·GB 由外部脚本注入(有/没有/晚到都能上妆)', async function () {
    await withSim(async function (sim) {
        // ---- 1. 只有 10 列: 必须照常上妆 ----
        sim.seed({ 'hdui.theme': 'film' });
        let page = await H.open(sim, 'hdhome-ui-nocalc');
        await H.waitState(page, 'applied');
        assertEq(await H.themeOf(page), 'film', '外部脚本没注入 A/A·GB 时仍然上妆');
        assertEq(await bannerVisible(page), false, '不弹结构错误横幅(缺的是可选列)');

        let s = await shape(page);
        assertEq(s.hasCalc, false, '剧本里确实没有 A/A·GB 两列');
        assertEq(s.head, 10, '表头 10 列, 实际 ' + s.head);
        assertEq(s.row, 10, '数据行 10 格, 实际 ' + s.row);

        // 列映射必须跟着变: 10 列时「发布者」是第 10 格, 胶片墙给它 11.5px + 省略号。
        // 用"吃到主题样式"来验证映射 —— 若 colMap 没跟着 10 列走, nth-child 就指错了格子, 样式落空。
        const last = await cellBefore(page, 9);
        assert(!!last, '取到最后一格(发布者)');
        const st = await page.eval([
            'const t = document.getElementById("torrenttable");',
            'const c = t.tBodies[0].rows[1].cells[9];',
            'const cs = getComputedStyle(c);',
            'return { fs: cs.fontSize, ell: cs.textOverflow };'
        ].join('\n'));
        assertEq(st.fs, '11.5px', '发布者吃到胶片墙的排版(列映射跟随 10 列), 实际 ' + st.fs);
        assertEq(st.ell, 'ellipsis', '发布者溢出用省略号, 实际 ' + st.ell);
        await page.close();

        // ---- 2. 之后外部脚本补进来: 自动重摆, 新格子要吃到主题样式 ----
        page = await H.open(sim, 'hdhome-ui-nocalc');
        await H.waitState(page, 'applied');
        const injected = await page.eval(INJECT);
        assertEq(injected.head, 12, '注入后表头 12 列');
        assertEq(injected.row, 12, '注入后数据行 12 格');
        await new Promise(function (r) { setTimeout(r, 2000); });

        assertEq(await page.eval('return document.documentElement.dataset.hduiState;'), 'applied',
            '补列后仍处于上妆态(没有回退)');
        assertEq(await H.themeOf(page), 'film', '补列后主题不变');
        assertEq(await bannerVisible(page), false, '补列过程没有误弹横幅');

        // 关键: 补进来的 A 值格要吃到胶片墙给数值列的排版 —— 证明 colMap 重算过。
        // (胶片墙把栏名放在表头, 数据格上不挂 ::before 标签, 所以改看对齐 / 字号 / 字族)
        const aCell = await page.eval([
            'const c = document.querySelector("#torrenttable [data-calc-a]");',
            'if (!c) return null;',
            'const cs = getComputedStyle(c);',
            'return { align: cs.textAlign, fs: cs.fontSize, font: cs.fontFamily };'
        ].join('\n'));
        assert(!!aCell, '补进来的 A 值格存在');
        assertEq(aCell.align, 'right', 'A 值格吃到了数值列的右对齐(列映射重算过)');
        assertEq(aCell.fs, '11.5px', 'A 值格吃到胶片墙的字号, 实际 ' + aCell.fs);
        assert(/Bahnschrift|DIN|Consolas/i.test(aCell.font), 'A 值用等宽数字, 实际 ' + aCell.font);
        await page.close();

        // ---- 3. 反过来撤走两列: 同样不回退 ----
        page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        const removed = await page.eval(REMOVE);
        assertEq(removed.head, 10, '撤走后表头 10 列');
        await new Promise(function (r) { setTimeout(r, 2000); });
        assertEq(await page.eval('return document.documentElement.dataset.hduiState;'), 'applied',
            '撤走两列后仍上妆');
        assertEq(await bannerVisible(page), false, '撤列不弹横幅');
        assertEq(await H.themeOf(page), 'film', '撤列后主题不变');
        await page.close();

        // ---- 4. 只补表头(补到一半): 不得立刻弹横幅, 等窗口内自行恢复 ----
        page = await H.open(sim, 'hdhome-ui-nocalc');
        await H.waitState(page, 'applied');
        await page.eval(INJECT_HEAD_ONLY); // 此刻表头 12 / 数据行 10 -> ROW_CELL_COUNT_MISMATCH
        await new Promise(function (r) { setTimeout(r, 900); }); // 结构守卫有 500ms 去抖
        assertEq(await bannerVisible(page), false, '补列补到一半时**不**立刻弹横幅(有等待窗口)');
        assertEq(await page.eval('return document.documentElement.dataset.hduiState;'), 'pending',
            '补到一半时处于「等结构就绪」窗口(不是上妆也不是回退)');
        assertEq(await H.themeOf(page), 'film', '等窗口期间保留当前主题, 不卸妆闪一下');
        // 补齐数据行后应自行恢复
        await page.eval(INJECT_ROW_ONLY);
        await new Promise(function (r) { setTimeout(r, 2500); });
        assertEq(await page.eval('return document.documentElement.dataset.hduiState;'), 'applied',
            '补齐后自行恢复上妆');
        assertEq(await bannerVisible(page), false, '全程无横幅');
        const after = await shape(page);
        assertEq(after.head, 12, '恢复后表头 12 列');
        assertEq(after.row, 12, '恢复后数据行 12 格');
        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
