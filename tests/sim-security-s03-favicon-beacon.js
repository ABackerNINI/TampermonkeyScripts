'use strict';
/**
 * S03 favicon 外链信标(A2) —— 已修复, 本用例锁定修复后的行为
 * ------------------------------------------------------------------
 * 修复前: collectFavicon 只过滤伪协议(^https?:), 不过滤来源。站 A 在 <link rel="icon">
 * 挂一个外链 URL, 它就会以 ptac_favicon_<uid> 长期驻留; 此后用户在**任意其它 PT 站**
 * 打开面板, 该外链都作为 <img src> 嵌入 → 站 A 拿到一个跨站跟踪信标。
 * 修复后: 只允许本站主域及其子域(CDN 图标), 跨站一律丢弃并回落 /favicon.ico。
 */

const { withSim } = require('./sim/harness');
const { runCase, assert } = require('./sim/tcase');

const A = 'http://www.tangpt.top';
const B = 'http://www.pttime.org';
const UID = 'tangpt';
const BEACON = 'http://evil.test/beacon.png';

runCase('S03 favicon 外链跨站信标(应被同站约束挡下)', async () => {
    await withSim(async (sim) => {
        const pageA = await sim.open(`${A}/?sim=evil-favicon-exfil`, { waitMs: 5000 });
        await sim.sleep(2000);
        const stored = sim.get(`ptac_favicon_${UID}`);
        assert(!stored, `跨站 icon 不应落存储, 实际: ${JSON.stringify(stored)}`);
        assert(String(stored || '').indexOf('evil.test') < 0, '跨站 icon 落进了存储');
        await pageA.close();

        // 其它站点面板里不得出现该外链
        const pageB = await sim.open(`${B}/?sim=already`, { waitMs: 5000 });
        const probe = await pageB.eval(`
            const root = document.getElementById('ptac-root-v2');
            return { hasUi: !!root, srcs: root ? Array.from(document.images || []).map((i) => i.src).filter((s) => s.indexOf('evil.test') >= 0) : [] };
        `);
        assert(probe.hasUi, '面板未渲染, 用例前提不成立');
        assert(probe.srcs.length === 0, '页面里出现了指向 evil.test 的图片请求');
        const hits = sim.requests({ host: 'evil.test' });
        assert(hits.length === 0, `evil.test 被请求了 ${hits.length} 次`);

        // 正向: 本站 icon 仍应被正常采集(不能把功能一起砍掉)
        sim.reset();
        const pageC = await sim.open(`${A}/?sim=favicon-same-site`, { waitMs: 5000 });
        await sim.sleep(2000);
        const ok = sim.get(`ptac_favicon_${UID}`);
        assert(ok === 'http://www.tangpt.top/static/logo.png',
            `本站 icon 应正常采集, 实际: ${JSON.stringify(ok)}`);
        await pageC.close();
    });
});
