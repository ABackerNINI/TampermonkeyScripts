'use strict';
/**
 * S04 基线: favicon 伪协议过滤(javascript: / data: 不得落存储)
 * 对应 collectFavicon 里的 `if (!/^https?:/i.test(abs)) return;`
 *
 * ⚠️ 覆盖率自白(2026-09-20 用反例量过, 别对这条用例抱有错觉):
 *    把那行协议过滤**删掉**, 本用例**依然通过** —— 因为紧接着的同站约束
 *    (`isSameSiteHost(iconHost, unitHostOf(u))`) 也会把 javascript:/data: 挡下来
 *    (这两种 URL 的 hostname 是空串, 永远不可能"同站")。
 *    也就是说: 协议过滤在当前代码里是**纵深防御的第二道**, 不是唯一一道;
 *    本用例真正能抓住的退化是"两道一起被删"(那时才会真的落存储)。
 *    ⇒ 想验证协议过滤本身, 需要能构造一个"同站但非 http(s)" 的图标 URL —— 不存在这种 URL,
 *      所以这条防护在当前实现下**无法被端到端证伪**。留着它是因为它仍能锁住"两道都没了"的退化。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';

const CASES = [
    { sim: 'evil-icon-javascript', scheme: 'javascript:' },
    { sim: 'evil-icon-data', scheme: 'data:' }
];

runCase('S04 favicon 伪协议过滤', async () => {
    await withSim(async (sim) => {
        for (const c of CASES) {
            sim.reset();
            const page = await sim.open(`${A}/?sim=${c.sim}`);
            // ⚠️ 不能"固定 sleep 4s 再读存储" —— 两个方向的错:
            //   ① 机器慢时脚本还没跑到 collectFavicon(), stored 是 undefined, 断言**假绿**
            //      (等于什么都没验 —— 这比红灯更危险);
            //   ② 机器更慢时又可能读到上一个用例残留的值。
            //   collectFavicon() 在 main() 的**第一行**, UI(#ptac-root-v2) 在其后挂载
            //   ⇒ 轮询到 UI 存在, 就一定已经执行过过滤了。
            await page.waitFor(`return !!document.getElementById('ptac-root-v2')`, 20000, 'ptac-ui');
            const stored = sim.get(`ptac_favicon_${UID}`);
            assert(!stored, `${c.scheme} 伪协议被写入存储: ${JSON.stringify(stored)}`);
            assert(!String(stored || '').toLowerCase().startsWith(c.scheme.replace(':', '')),
                `${c.scheme} 落进了存储`);
            await page.close();
        }
    });
});
