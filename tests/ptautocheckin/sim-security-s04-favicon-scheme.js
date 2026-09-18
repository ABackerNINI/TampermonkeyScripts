'use strict';
/**
 * S04 基线: favicon 伪协议过滤(javascript: / data: 不得落存储)
 * 对应 collectFavicon 里的 `if (!/^https?:/i.test(abs)) return;`
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
            const page = await sim.open(`${A}/?sim=${c.sim}`, { waitMs: 4000 });
            const stored = sim.get(`ptac_favicon_${UID}`);
            assert(!stored, `${c.scheme} 伪协议被写入存储: ${JSON.stringify(stored)}`);
            assert(!String(stored || '').toLowerCase().startsWith(c.scheme.replace(':', '')),
                `${c.scheme} 落进了存储`);
            await page.close();
        }
    });
});
