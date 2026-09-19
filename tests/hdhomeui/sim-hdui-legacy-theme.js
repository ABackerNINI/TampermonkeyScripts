#!/usr/bin/env node
'use strict';
/**
 * 仿真: 旧主题 id 的迁移(2026.09.19.7 移除 5 套后, 存储里可能还留着旧值)
 * ------------------------------------------------------------------
 * 用户实测报错: `[HDHomeUI] 页面结构与预期不符(E_UNKNOWN_THEME), 已恢复站点默认界面。未知主题 tape`
 * —— 他选过 `tape`, 主题被删后脚本把它当成"页面结构坏了"。
 *
 * 关键断言:
 *   ① 旧 5 套 id 全部**静默迁到胶片墙**(不弹横幅), 并写回存储 —— 用户没做错任何事
 *   ② 真正无效的值(不是旧 id)才回落默认, 且横幅说「主题设置无效」, **不能**说「页面结构与预期不符」
 *      (那是结构类的措辞, 会把排查方向带偏)
 *   ③ 这种情况不该进「等结构就绪」窗口 —— 等也没用
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const LEGACY = ['reel', 'tape', 'sheet', 'swiss', 'signal'];

/** 横幅文案(没弹就返回 null) */
function alertText(page) {
    return page.eval([
        'const b = document.getElementById("hdui-alert");',
        'if (!b) return null;',
        'const t = b.querySelector(\'[data-hdui="alert-text"]\');',
        'return t ? t.textContent : "";'
    ].join('\n'));
}

runCase('HDHomeUI · 旧主题 id 迁移 / 无效值不误报为结构问题', async function () {
    await withSim(async function (sim) {
        // ---- 1. 旧 5 套 id: 静默迁到胶片墙 ----
        for (const old of LEGACY) {
            sim.seed({ 'hdui.theme': old });
            const page = await H.open(sim, 'hdhome-ui');
            await H.waitState(page, 'applied');

            assertEq(await H.themeOf(page), 'film', '旧主题 ' + old + ' 迁移到胶片墙');
            assertEq(await alertText(page), null, '旧主题 ' + old + ' 不弹横幅(用户没做错事)');
            assertEq(sim.get('hdui.theme'), 'film', '旧主题 ' + old + ' 已写回存储');
            assertEq(await page.eval('return document.documentElement.dataset.hduiState;'), 'applied',
                '旧主题 ' + old + ' 正常上妆(不是 fallback)');
            await page.close();
        }

        // ---- 2. 真正无效的值: 回落默认, 但措辞必须是「主题设置无效」 ----
        sim.seed({ 'hdui.theme': 'bogus-theme' });
        let p = await H.open(sim, 'hdhome-ui');
        await H.waitState(p, 'fallback');
        assertEq(await H.themeOf(p), 'default', '无效值回落原站默认');

        const txt = await alertText(p);
        assert(!!txt, '无效值弹出了横幅');
        assert(txt.indexOf('主题设置无效') >= 0, '横幅说「主题设置无效」, 实际: ' + txt);
        assert(txt.indexOf('页面结构与预期不符') < 0,
            '横幅**不能**说「页面结构与预期不符」(会把排查方向带偏), 实际: ' + txt);
        assert(txt.indexOf('E_BAD_THEME') >= 0, '错误码是配置类的 E_BAD_THEME, 实际: ' + txt);

        // 不该进等待窗口(等也没用), 所以状态不是 pending
        assertEq(await p.eval('return document.documentElement.dataset.hduiState;'), 'fallback',
            '无效值直接 fallback, 不进等结构就绪窗口');

        // ---- 3. 横幅上的「改用胶片墙」按钮应能一键恢复 ----
        const clicked = await p.eval([
            'const b = document.getElementById("hdui-alert");',
            'const btn = b && b.querySelector(\'[data-hdui="alert-retry"]\');',
            'if (!btn) return null;',
            'const label = btn.textContent;',
            'btn.click();',
            'return label;'
        ].join('\n'));
        assertEq(clicked, '改用胶片墙', '配置类横幅给的是「改用胶片墙」而不是没用的「重新尝试」');
        await p.close();

        // ---- 4. 迁移后重新打开: 直接上妆, 不再走迁移分支 ----
        p = await H.open(sim, 'hdhome-ui');
        await H.waitState(p, 'applied');
        assertEq(await H.themeOf(p), 'film', '迁移后重新打开直接上妆胶片墙');
        assertEq(await alertText(p), null, '迁移后不再弹横幅');
        await p.close();
    }, { scriptPath: H.HDUI_PATH });
});
