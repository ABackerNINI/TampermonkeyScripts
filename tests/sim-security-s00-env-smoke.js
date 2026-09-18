'use strict';
/**
 * S00 环境自检 + 端到端冒烟
 * ------------------------------------------------------------------
 * 验证「仿真站」这套机制本身成立:
 *   1. 真实域名 URL 能被 --host-resolver-rules 指到本地服务器, 且 Host 头保留;
 *   2. 生产 userscript(未改动) 在仿真页上真的跑起来了(写下了 GM 状态);
 *   3. 走通一次完整被动签到: 首页点击 → 跳转落地页 → 状态 success。
 * 这一条不过, 后面所有安全用例的结论都不可信 —— 所以它是门禁。
 */

const { withSim, todayStr } = require('./sim/harness');
const { runCase, assert, assertEq, waitStore } = require('./sim/tcase');

const SITE = 'http://www.tangpt.top';
const UID = 'tangpt';

runCase('S00 仿真站环境自检 + 被动签到冒烟', async () => {
    await withSim(async (sim) => {
        // 1) 环境自检: 真实域名落到本地仿真服务器, Host 头保留
        await sim.open(`${SITE}/?sim=index`, { waitMs: 500 });
        const hits = sim.requests({ host: 'www.tangpt.top' });
        assert(hits.length > 0, '仿真服务器未收到 www.tangpt.top 的请求(host-resolver 未生效)');
        assert(hits.some((r) => r.path === '/'), '未收到根路径请求');

        // 2) 脚本确实在页面里运行: 注入的 GM 存储键会被脚本读写
        await sim.open(`${SITE}/?sim=already`, { waitMs: 6000 });
        const st = await waitStore(sim, `ptac_status_${UID}`,
            (v) => v && v.date === todayStr() && v.status === 'success', 15000, '已签到页 → success');
        assertEq(st.status, 'success', '访问已签到页应直接判 success');

        // 3) 端到端冒烟: 未签首页 → 点击 → 落地页确认 → success
        sim.reset();
        const page = await sim.open(`${SITE}/?sim=index`, { waitMs: 1000 });
        const st2 = await waitStore(sim, `ptac_status_${UID}`,
            (v) => v && v.date === todayStr() && (v.status === 'success' || v.status === 'pending'), 25000, '首页点击 → 结果');
        const nav = sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' });
        assert(nav.length > 0, '脚本未点击签到按钮(未观测到 /attendance.php 请求)');
        await waitStore(sim, `ptac_status_${UID}`,
            (v) => v && v.status === 'success', 20000, '落地页确认 → success');
        assertEq(sim.get(`ptac_status_${UID}`).status, 'success', '完整流程应落到 success');

        // 冷却: 冒烟结束前确认没有多余重复点击(单次访问只应产生一次签到点击)
        await sim.sleep(500);
        const navAll = sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' });
        assertEq(navAll.length, 1, '一次被动签到只应产生 1 次 /attendance.php 请求');
        await page.close();
    });
});
