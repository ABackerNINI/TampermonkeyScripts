#!/usr/bin/env node
'use strict';
/**
 * 仿真: 结构守卫(页面改版 ⇒ 提醒 + 回退默认 UI, 且不得误触站内动作)
 * ------------------------------------------------------------------
 * 四种剧本:
 *   hdhome-ui-broken   表头缺一列        -> E_COLUMN_UNKNOWN
 *   hdhome-ui-nonav    缺主框架/导航锚点 -> E_ANCHOR_MISSING
 *   hdhome-ui-empty    有表头无数据行    -> 不算错, 正常上妆
 *   hdhome-ui-notable  本页无种子表      -> 只上全局妆(OK_NO_TABLE)
 * 外加: 运行中把表结构改坏 -> MutationObserver 重新校验 -> 自动回退
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

function pageInfo(page) {
    return page.eval([
        'return {',
        '  state: document.documentElement.dataset.hduiState || null,',
        '  theme: document.documentElement.dataset.hduiTheme || null,',
        '  css: !!document.getElementById("hdui-css"),',
        '  boot: !!document.getElementById("hdui-boot"),',
        '  alert: (document.getElementById("hdui-alert") || {}).textContent || null,',
        '  bg: getComputedStyle(document.body).backgroundColor',
        '};'
    ].join('\n'));
}

runCase('HDHomeUI · 结构守卫与回退默认 UI', async function () {
    await withSim(async function (sim) {
        sim.seed({ 'hdui.theme': 'reel' });

        // ---- 1. 表头缺一列 ----
        let page = await H.open(sim, 'hdhome-ui-broken');
        await H.waitState(page, 'fallback');
        let info = await pageInfo(page);
        assertEq(info.state, 'fallback', '缺列: 状态为 fallback');
        assertEq(info.theme, 'default', '缺列: 回落到原站默认');
        assertEq(info.css, false, '缺列: 没有注入任何主题样式');
        assertEq(info.boot, false, '缺列: 底色补丁一并撤掉');
        assert(info.alert && info.alert.indexOf('E_COLUMN_UNKNOWN') >= 0, '缺列: 横幅给出错误码 —— ' + info.alert);
        assert(info.alert.indexOf('进度') >= 0 || info.alert.indexOf('列') >= 0, '缺列: 横幅说明是哪一列出了问题');
        assert(page.logs.some(function (l) { return /\[error\].*E_COLUMN_UNKNOWN/.test(l); }),
            '缺列: 控制台有 error 级记录(不许静默)');
        assertEq(H.dangerousHits(sim).length, 0, '缺列: 回退过程零危险端点访问');
        const err = sim.get('hdui.lastError');
        assert(err && err.code === 'E_COLUMN_UNKNOWN', '缺列: 错误写入 GM 存储, 实际 ' + JSON.stringify(err));
        await page.close();

        // ---- 1b. 数据行单元格数对不上表头 ----
        page = await H.open(sim, 'hdhome-ui-shape');
        await H.waitState(page, 'fallback');
        info = await pageInfo(page);
        assert(info.alert && info.alert.indexOf('ROW_CELL_COUNT_MISMATCH') >= 0,
            '行列数不符: 横幅给出错误码 —— ' + info.alert);
        assertEq(H.dangerousHits(sim).length, 0, '行列数不符: 回退过程零危险端点访问');
        await page.close();

        // ---- 2. A 级锚点缺失 ----
        page = await H.open(sim, 'hdhome-ui-nonav');
        await H.waitState(page, 'fallback');
        info = await pageInfo(page);
        assert(info.alert && info.alert.indexOf('E_ANCHOR_MISSING') >= 0, '缺锚点: 横幅给出错误码 —— ' + info.alert);
        assert(info.alert.indexOf('导航') >= 0, '缺锚点: 横幅点名缺失的锚点');
        await page.close();

        // ---- 3. 空表体不算结构错误 ----
        page = await H.open(sim, 'hdhome-ui-empty');
        await H.waitState(page, 'applied');
        assertEq(await H.themeOf(page), 'reel', '空表体: 正常上妆(没有种子 != 结构损坏)');
        assertEq(await page.eval('return !!document.getElementById("hdui-alert");'), false, '空表体: 不误报横幅');
        await page.close();

        // ---- 4. 无种子表的页面只上全局妆 ----
        page = await H.open(sim, 'hdhome-ui-notable');
        await H.waitState(page, 'applied');
        info = await pageInfo(page);
        assertEq(info.css, true, '无种子表: 仍应用全局样式');
        assertEq(info.bg, 'rgb(22, 24, 28)', '无种子表: 全局底色生效');
        assert(page.logs.some(function (l) { return /OK_NO_TABLE/.test(l); }), '无种子表: 日志记录"本页无种子表"');
        await page.close();

        // ---- 5. 恢复正常页 ----
        page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        assertEq(await page.eval('return !!document.getElementById("hdui-alert");'), false, '正常页: 不再弹横幅');
        await page.close();

        // ---- 6. 运行中把结构改坏 -> 自动回退 ----
        page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        await page.eval([
            'const tb = document.getElementById("torrenttable").tBodies[0];',
            'const head = tb.rows[0];',
            'head.removeChild(head.cells[head.cells.length - 1]);',  // 删掉「发布者」列
            'Array.prototype.forEach.call(tb.rows, function (r) {',
            '  if (r.cells.length > 11) r.removeChild(r.cells[r.cells.length - 1]);',
            '});',
            'return 1;'
        ].join('\n'));
        await page.waitFor('return document.documentElement.dataset.hduiState === "fallback";', 10000, '运行中回退');
        info = await pageInfo(page);
        assertEq(info.css, false, '运行中改坏: 自动卸妆');
        assert(info.alert && info.alert.indexOf('E_') >= 0, '运行中改坏: 弹出横幅 —— ' + info.alert);
        assert(page.logs.some(function (l) { return /E_STRUCTURE_CHANGED/.test(l); }),
            '运行中改坏: 控制台记录结构变化');
        assertEq(H.dangerousHits(sim).length, 0, '运行中改坏: 仍零危险端点访问');
        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
