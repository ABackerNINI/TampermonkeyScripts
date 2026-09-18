'use strict';
/**
 * S01 基线: 生产代码不得在 window 上留任何内部符号 / 测试后门
 * (conventions.md §8.2: 禁止为诊断/测试把内部函数挂到 window 或加 window.__TEST__)
 */

const fs = require('fs');
const path = require('path');
const { withSim } = require('./sim/harness');
const { runCase, assert } = require('./sim/tcase');

const SRC = path.join(__dirname, '..', 'src', 'PTAutoCheckIn.user.js');

runCase('S01 无 window 后门(静态 + 运行时)', async () => {
    // --- 静态 ---
    const src = fs.readFileSync(SRC, 'utf8');
    assert(!/window\.__/.test(src), '源码出现 window.__xxx(禁止的调试/测试后门)');
    assert(!/unsafeWindow/.test(src), '源码使用 unsafeWindow(会与主世界共享作用域)');
    assert(!/\b__TEST__\b/.test(src), '源码出现 __TEST__ 测试开关');

    // --- 运行时 ---
    await withSim(async (sim) => {
        const page = await sim.open('http://www.tangpt.top/?sim=index', { waitMs: 5000 });
        const leaked = await page.eval(`
            const shim = new Set(['GM_getValue','GM_setValue','GM_deleteValue','GM_log','GM_openInTab','__PTAC_SHIM__']);
            const bad = /ptac|PTAuto|ScriptName|STATUS_TRANSITIONS|UNIT_MAP|UNITS|SITES|computeUnitBudget|writeStatus|readStatus|matchUnit|runUnit|auditUnit/i;
            return Object.keys(window).filter((k) => !shim.has(k) && bad.test(k));
        `);
        assert(leaked.length === 0, 'window 上泄漏内部符号: ' + leaked.join(', '));

        const probe = await page.eval(`
            return {
                gmGet: typeof window.GM_getValue,
                internal: [typeof window.writeStatus, typeof window.readStatus, typeof window.matchUnit, typeof window.computeUnitBudget]
            };
        `);
        assert(probe.internal.every((t) => t === 'undefined'), '内部函数被挂到了 window');
        await page.close();
    });
});
