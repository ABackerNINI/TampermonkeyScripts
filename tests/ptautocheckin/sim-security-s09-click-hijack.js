'use strict';
/**
 * S09 点击劫持 / 选择器欺骗(A5)
 * ------------------------------------------------------------------
 * 9a(已修复): 站外 href —— 选择器只约束 href 的**子串**(a[href*="attendance.php"]),
 *   所以 https://evil.test/attendance.php 也会命中并带着用户会话点出去。
 *   修复: 点击前校验 href 必须属于本站(协议 + host), 否则拒绝点击。
 * 9b(残留风险, 明确记录): 同站任意参数 —— 站点仍可放一个文案合规、href 为
 *   attendance.php?action=... 的链接, 脚本会点并把结果记为 success。
 *   不修的原因: 攻击者在**自己站内**本就能以用户身份发起任意请求, 脚本只是省了用户那一次点击;
 *   而"禁止 href 带配置外的 query"会误伤真实站点(配置里确有 index.php?action=addbonus 这类
 *   带参入口), 属于会破坏功能的改动, 需真站回归后再决定 —— 见 pitfalls P29 的待办。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';
const offsite = (sim) => sim.requests({ host: 'evil.test' }).length;
const onsite = (sim) => sim.requests({ host: 'www.tangpt.top', path: '/attendance.php' }).length;

runCase('S09 9a 站外伪造按钮应被拒绝 / 9b 同站任意参数仍会点击(已知残留)', async () => {
    await withSim(async (sim) => {
        // ---- 9a 站外 ----
        let page = await sim.open(`${A}/?sim=evil-offsite-button`, { waitMs: 9000 });
        await sim.sleep(3000);
        assertEq(offsite(sim), 0, '脚本点击了指向站外的伪造按钮');
        const st = sim.get(`ptac_status_${UID}`);
        assert(!st || st.status !== 'success', '站外伪造按钮被误判为签到成功');
        console.log(`  实测 9a: 站外 href 未产生任何 evil.test 请求, 状态=${st ? st.status : '无'}`);
        await page.close();

        // ---- 9b 同站任意参数(残留风险, 记录现状) ----
        sim.reset();
        page = await sim.open(`${A}/?sim=evil-fake-button`, { waitMs: 9000 });
        await sim.sleep(4000);
        const danger = sim.requests({ host: 'www.tangpt.top' }).filter((r) => r.url.includes('action=DANGER'));
        assert(danger.length > 0,
            '同站任意参数入口**不再**被点击 —— 若已加固, 请把本段改为断言"必须拒绝", 并同步 pitfalls P29');
        const st2 = sim.get(`ptac_status_${UID}`);
        assert(st2 && st2.status === 'success',
            '同站任意参数入口被点击后不再记为 success —— 行为变化, 请同步更新本用例与 P29');
        console.log(`  实测 9b(残留风险, 未修): 同站 href 带 action=DANGER 的伪造入口被点击 ${danger.length} 次并记为 success`);
        console.log('  理由: 攻击者在自己站内本就能以用户身份发请求; 禁用"配置外 query"会误伤 index.php?action=addbonus 这类真实带参入口。');
        assertEq(onsite(sim), danger.length, '同站点击计数不一致');
        await page.close();
    });
});
