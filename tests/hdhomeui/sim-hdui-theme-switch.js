#!/usr/bin/env node
'use strict';
/**
 * 仿真: 5 套主题切换、版式差异、切回默认、记忆与快捷键
 * ------------------------------------------------------------------
 * 关键断言: 5 套主题的**版式签名**(表格/tbody/行的 display、网格轨道、字号、分隔线、
 * 字体族、底色)两两不同 —— 用来证明它们是不同版式, 而不只是换了个配色。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const THEMES = ['reel', 'tape', 'sheet', 'swiss', 'signal'];
const ALL_IDS = ['default'].concat(THEMES);

runCase('HDHomeUI · 主题切换 / 版式差异 / 记忆', async function () {
    await withSim(async function (sim) {
        // ---- 逐个上妆, 收集版式签名 ----
        const sigs = {};
        for (const id of THEMES) {
            sim.seed({ 'hdui.theme': id });
            const page = await H.open(sim, 'hdhome-ui');
            await H.waitState(page, 'applied');
            assertEq(await H.themeOf(page), id, '主题 ' + id + ' 已生效');
            sigs[id] = await H.signature(page);
            assert(!!sigs[id], '主题 ' + id + ' 取到版式签名');
            await page.close();
        }

        // ---- 签名两两不同 ----
        const seen = new Map();
        for (const id of THEMES) {
            const key = JSON.stringify(sigs[id]);
            assert(!seen.has(key), '主题 ' + id + ' 的版式签名与 ' + seen.get(key) + ' 完全相同(等于只换配色)');
            seen.set(key, id);
        }

        // ---- 各套的骨架特征(具体而非笼统) ----
        assertEq(sigs.tape.table, 'table', '电传纸带: 保持表格语义');
        assertEq(sigs.tape.row, 'table-row', '电传纸带: 行仍是表格行');
        assertEq(sigs.reel.tbody, 'grid', '片库索引: 表体是卡片网格');
        assertEq(sigs.reel.row, 'grid', '片库索引: 行是 6 轨网格(主行/指标带/尾注)');
        assertEq(sigs.sheet.row, 'flex', '大开本: 行是三段式长条');
        assertEq(sigs.signal.row, 'grid', '播控台: 行是网格');
        assertEq(sigs.swiss.row, 'grid', '瑞士网格: 行是 6 列网格');
        assert(sigs.signal.cols.split(' ').length === 4, '播控台: 行分 4 轨道, 实际 ' + sigs.signal.cols);
        assert(sigs.reel.cols.split(' ').length === 6, '片库索引: 行分 6 轨道, 实际 ' + sigs.reel.cols);

        const fonts = new Set(THEMES.map(function (id) { return sigs[id].bodyFont; }));
        assert(fonts.size >= 3, '字体族 >= 3 种, 实际 ' + fonts.size);
        const bgs = new Set(THEMES.map(function (id) { return sigs[id].bodyBg; }));
        assertEq(bgs.size, 5, '5 套底色互不相同');
        const seedFonts = new Set(THEMES.map(function (id) { return sigs[id].seedFont; }));
        assert(seedFonts.size >= 4, '做种数字号 >= 4 种, 实际 ' + Array.from(seedFonts).join('/'));
        const borders = new Set(THEMES.map(function (id) { return sigs[id].rowBorder; }));
        assert(borders.size >= 3, '行分隔手段 >= 3 种, 实际 ' + Array.from(borders).join('/'));

        for (const id of THEMES) {
            assert(/^#[0-9a-f]{6}$/i.test(sigs[id].cat), '主题 ' + id + ' 写入了类别色: ' + sigs[id].cat);
            assert(sigs[id].ratio !== '', '主题 ' + id + ' 写入了电平比例');
        }

        // ---- 切回「原站默认」必须卸干净 ----
        sim.seed({ 'hdui.theme': 'default' });
        let p = await H.open(sim, 'hdhome-ui');
        await p.waitFor('return document.documentElement.dataset.hduiState === "off";', 10000, 'state=off');
        const clean = await p.eval([
            'const t = document.getElementById("torrenttable");',
            'const r = t.tBodies[0].rows[1];',
            'return {',
            '  css: !!document.getElementById("hdui-css"),',
            '  boot: !!document.getElementById("hdui-boot"),',
            '  alert: !!document.getElementById("hdui-alert"),',
            '  props: r.style.getPropertyValue("--hdui-cat") + "|" + r.style.getPropertyValue("--hdui-ratio"),',
            '  theme: document.documentElement.dataset.hduiTheme',
            '};'
        ].join('\n'));
        assertEq(clean.css, false, '回退后主题样式节点已移除');
        assertEq(clean.boot, false, '回退后底色补丁已移除');
        assertEq(clean.alert, false, '回退后不弹横幅(是主动选择, 不是错误)');
        assertEq(clean.props, '|', '回退后行上的自定义属性已清理');
        assertEq(clean.theme, 'default', '回退后状态标记为 default');
        await p.close();

        // ---- 记忆: 记住上次选择 ----
        sim.seed({ 'hdui.theme': 'sheet' });
        p = await H.open(sim, 'hdhome-ui');
        await H.waitState(p, 'applied');
        assertEq(await H.themeOf(p), 'sheet', '重新打开记住上次选择: sheet');

        // ---- 面板: 真实鼠标点击可切换 ----
        await H.clickDock(p);
        const top = await H.panelTop(p);
        assert(top !== null, '点内嵌开关后面板展开(hit-test 命中 shadow 宿主)');
        const changed = await H.clickFirstPanelItemThatChanges(p);
        assert(changed !== null && changed !== 'sheet', '点面板条目可切换主题: sheet -> ' + changed);
        assert(ALL_IDS.indexOf(changed) >= 0, '切换结果是合法主题 id: ' + changed);

        // ---- 快捷键循环切换 ----
        const before = await H.themeOf(p);
        await H.pressAltShiftT(p);
        const after = await H.themeOf(p);
        assert(after !== before, 'Alt+Shift+T 循环切换生效: ' + before + ' -> ' + after);
        await p.close();

        // ---- 记忆落盘并重放 ----
        p = await H.open(sim, 'hdhome-ui');
        await H.waitState(p, 'applied');
        assertEq(await H.themeOf(p), after, '再次打开页面仍记得 ' + after);
        assertEq(sim.get('hdui.theme'), after, 'GM 存储写入正确');
        await p.close();
    }, { scriptPath: H.HDUI_PATH });
});
