'use strict';
/**
 * S11 冷却基线 + S16 超时/无信号基线
 * ------------------------------------------------------------------
 * S11: 冷却窗内(10 分钟)重复访问不得重复点击; 且"冷却跳过"不得把已有结论改写成失败
 *      (P28 单向阶梯的核心保证)。
 * S16: 页面永远找不到签到元素时, 必须在 UNIT_TOTAL_TIMEOUT 内给出结论(failed/unconfirmed),
 *      不得挂死 —— 这是"恶意页面用永不出现的元素拖死脚本"的边界。
 */

const { withSim, todayStr } = require('./sim/harness');
const { runCase, assert, assertEq, waitStore } = require('./sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';
const clicks = (sim) => sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' }).length;

runCase('S11 冷却内不重复点击 + S16 无元素时按时收敛', async () => {
    await withSim(async (sim) => {
        // ---- S11 ----
        let page = await sim.open(`${A}/?sim=index`, { waitMs: 8000 });
        await waitStore(sim, `ptac_status_${UID}`, (v) => v && v.status === 'success', 25000, '首次签到成功');
        const c1 = clicks(sim);
        assertEq(c1, 1, '首次签到应只点击一次');
        await page.close();

        // 伪造成"上次未确认"(冷却仍在) → 再访问: 应被冷却拦住, 不点击、不改写状态
        sim.seed({ [`ptac_status_${UID}`]: { date: todayStr(), status: 'unconfirmed', msg: '模拟', ts: Date.now() } });
        page = await sim.open(`${A}/?sim=index`, { waitMs: 9000 });
        await sim.sleep(3000);
        assertEq(clicks(sim), c1, '冷却期内重复点击了签到按钮');
        assertEq(sim.get(`ptac_status_${UID}`).status, 'unconfirmed', '冷却跳过把「未确认」改写了');
        await page.close();

        // ---- S16: 无签到入口, 必须收敛 ----
        sim.reset();
        const t0 = Date.now();
        page = await sim.open(`${A}/?sim=none`, { waitMs: 1000 });
        const st = await waitStore(sim, `ptac_status_${UID}`,
            (v) => v && ['failed', 'unconfirmed', 'skipped'].includes(v.status), 45000, '无元素时应按时收敛');
        const cost = Date.now() - t0;
        assert(cost < 45000, `无元素场景耗时 ${cost}ms, 超过单站总预算`);
        console.log(`  实测: 无签到入口时 ${(cost / 1000).toFixed(1)}s 收敛为 ${st.status}(${st.msg || ''})`);
        assertEq(clicks(sim), 0, '无签到入口时不应产生点击');
        await page.close();
    });
});
