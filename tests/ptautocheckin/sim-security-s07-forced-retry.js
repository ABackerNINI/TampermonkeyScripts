'use strict';
/**
 * S07 URL 参数强制动作(A4) —— 已修复, 本用例同时锁定"挡住外部链接"与"正常重试不被误伤"
 * ------------------------------------------------------------------
 * 修复前: 任何人诱导用户打开 <站点>/?ptacRetry=<uid> 即可让脚本带着用户会话、
 * 无视 10 分钟冷却反复点击签到(实测冷却窗内两次触发 = 2 次点击)。
 * 修复后: 强制重试必须出示脚本自签的一次性票据 ptacToken(GM 存储里, 用完即废)。
 *   · 外部拼的链接: 无票据 → 退化为普通访问, 不强制点击;
 *   · 面板点「重试」: 脚本自带票据 → 功能不变。
 */

const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq, waitStore } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';
const clicks = (sim) => sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' }).length;

runCase('S07 ?ptacRetry 需一次性票据(外部链接无效 / 面板重试仍可用)', async () => {
    await withSim(async (sim) => {
        // ---- 1) 外部构造的 ?ptacRetry(无票据)不得强制点击 ----
        sim.seed({ [`ptac_status_${UID}`]: { date: todayStr(), status: 'success', msg: '预置', ts: Date.now() } });
        let page = await sim.open(`${A}/?sim=index&ptacRetry=${UID}`, { waitMs: 8000 });
        await sim.sleep(3000);
        assertEq(clicks(sim), 0, '无票据的 ?ptacRetry 竟然触发了强制签到点击');
        // 且 URL 上的参数应被剥掉(防 F5 重复)
        const url = await page.eval('return location.href;');
        assert(!url.includes('ptacRetry'), 'ptacRetry 参数未被剥除: ' + url);
        await page.close();

        // ---- 2) 带有效票据(模拟面板「重试」开出的标签)应照常工作 ----
        sim.reset();
        sim.seed({
            [`ptac_status_${UID}`]: { date: todayStr(), status: 'unconfirmed', msg: '模拟未确认', ts: Date.now() },
            [`ptac_retryticket_${UID}`]: { token: 'TICKET-TEST', ts: Date.now() }
        });
        page = await sim.open(`${A}/?sim=index&ptacRetry=${UID}&ptacToken=TICKET-TEST`, { waitMs: 9000 });
        await waitStore(sim, `ptac_status_${UID}`, (v) => v && v.status === 'success', 25000, '持票据的强制重试应生效');
        assertEq(clicks(sim), 1, '持票据的强制重试应点击 1 次');
        // 票据一次性: 用完后必须作废, 同一票据再开一次无效
        const ticket = sim.get(`ptac_retryticket_${UID}`);
        assertEq(ticket, null, '票据用完后未作废(可重放)');
        await page.close();

        // ---- 3) 重放同一票据不得再次强制点击 ----
        sim.seed({
            [`ptac_status_${UID}`]: { date: todayStr(), status: 'unconfirmed', msg: '模拟未确认', ts: Date.now() }
        });
        page = await sim.open(`${A}/?sim=index&ptacRetry=${UID}&ptacToken=TICKET-TEST`, { waitMs: 8000 });
        await sim.sleep(3000);
        assertEq(clicks(sim), 1, '重放已作废的票据竟然又触发了点击');
        await page.close();

        // ---- 4) 伪造 ptacTask 不得触发任何点击 ----
        sim.reset();
        page = await sim.open(`${A}/?sim=index&ptacTask=forged-task-id`, { waitMs: 6000 });
        await sim.sleep(2000);
        assertEq(clicks(sim), 0, '伪造 ptacTask 竟然触发了签到点击');
        assertEq(sim.get(`ptac_status_${UID}`), undefined, '伪造 ptacTask 竟然写入了状态');
        await page.close();
    });
});
