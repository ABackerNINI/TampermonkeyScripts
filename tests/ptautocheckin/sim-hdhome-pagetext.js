'use strict';
/**
 * HDHome 型站点(已签后签到入口被纯文本取代)的端到端回归
 * ------------------------------------------------------------------
 * 页面形态(见 tests/lib/sim/sites.js 的 HDHOME 剧本):
 *   未签: <a href="attendance.php" class="faqlink">签到得魔力</a>
 *   已签: 该链接**消失**, 魔力值行内出现「(签到已得10)」纯文本
 * 因此已签判定只能走整页文本通道(alreadyPageCheck), 无法靠按钮文案翻转。
 *
 * 覆盖四点:
 *   1) 已签页(入口已消失, 整页含「签到已得」)→ success, 且**不产生点击**;
 *   2) 未签页 → 点击 → 落地页(attendance.php, meta refresh 跳回)→ 首页检出已签 → success;
 *   3) 入口已消失但**没有**「签到已得」文本(文本未刷新/文案改版)→ 由 alreadyCheck
 *      「入口消失 + 登录态证据」判已签(success), 零点击;
 *   4) **未登录页**(同样没有入口, 但也没有魔力值信息栏)→ **不得**判已签 —— 这是
 *      `noButtonMeansCheckedIn` 的盲区(只看到"入口没了"就判已签 → 漏登录被报成"今日已成功")。
 *
 * 注: 第 3/4 条是一对, 共同锁定 alreadyCheck 的取值口径 —— 光有「入口消失」不够,
 * 必须有登录态证据才算已签(见 P31)。站点入口全站常驻由用户 2026.09.19 实测确认。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq, waitStore } = require('../lib/sim/tcase');

const A = 'http://hdhome.org';
const UID = 'hdhome';
const STATUS = `ptac_status_${UID}`;
const clicks = (sim) => sim.requests({ host: 'hdhome.org', path: '/attendance.php' }).length;

runCase('HDHome 已签纯文本通道 + 点击落地 + 入口消失兜底', async () => {
    await withSim(async (sim) => {
        // ---- 1) 已签页: 整页文本命中, 零点击 ----
        let page = await sim.open(`${A}/index.php?sim=hdhome-already`, { waitMs: 6000 });
        let st = await waitStore(sim, STATUS, (v) => v && v.status === 'success', 20000, '已签页应判成功');
        // msg = `检测到已签到(<source>)`。detectAlreadyCheckedIn 的通道顺序: 1 自定义 alreadyCheck
        // → 2 按钮文案 → 2.5 noButton(本站未开) → 3 整页文本。本页入口已随已签消失且魔力值信息栏
        // 在(登录态证据), 故命中 1「自定义判定」; 若整页文本先于自定义命中则显示「页面文案」, 同可接受。
        assert(/自定义判定|页面文案/.test(st.msg || ''),
            `已签来源应来自自定义判定或整页文本, 实际 msg=${st.msg}`);
        assertEq(clicks(sim), 0, '已签状态下不应点击签到按钮');
        await page.close();

        // ---- 2) 未签页: 点击 → 落地页跳回 → 首页检出已签 ----
        sim.reset();
        page = await sim.open(`${A}/index.php?sim=hdhome-index`, { waitMs: 1000 });
        st = await waitStore(sim, STATUS, (v) => v && v.status === 'success', 40000, '点击后应最终成功');
        assertEq(clicks(sim), 1, '未签时应只点击一次');
        // 落地页(attendance.php)确实被访问过: 证明走的是「点击 → 跳转 → 落地结算」链路
        assert(sim.requests({ host: 'hdhome.org', path: '/attendance.php' }).length === 1, '未访问签到落地页');
        console.log(`  实测: 点击后落地结算 → ${st.status}(${st.msg || ''})`);
        await page.close();

        // ---- 3) 入口消失(登录态在)但无已签文本: 仍应判已签(通道冗余) ----
        sim.reset();
        page = await sim.open(`${A}/index.php?sim=hdhome-gone`, { waitMs: 6000 });
        const st3 = await waitStore(sim, STATUS, (v) => v && v.status === 'success', 20000, '入口消失应判已签');
        assert(/自定义判定/.test(st3.msg || ''), `应命中自定义判定(入口消失+登录态), 实际 msg=${st3.msg}`);
        assertEq(clicks(sim), 0, '入口消失(已签)时不应产生点击');
        console.log(`  实测: 入口消失无已签文本 → ${st3.status}(${st3.msg || ''})`);
        await page.close();

        // ---- 4) 未登录页: 同样没入口, 但也没登录态证据 → 不得判已签 ----
        sim.reset();
        page = await sim.open(`${A}/index.php?sim=hdhome-guest`, { waitMs: 1000 });
        const st4 = await waitStore(sim, STATUS,
            (v) => v && ['unconfirmed', 'failed', 'skipped'].includes(v.status), 45000, '未登录页应收敛');
        assert(st4.status !== 'success', `未登录页被误判为已签(漏登录会被报成今日已成功): ${JSON.stringify(st4)}`);
        assert(/自定义判定|页面文案/.test(st4.msg || '') === false, `未登录页命中了已签通道: ${st4.msg}`);
        assertEq(clicks(sim), 0, '未登录页不应产生点击');
        console.log(`  实测: 未登录页收敛为 ${st4.status}(${st4.msg || ''})`);
        await page.close();
    });
});
