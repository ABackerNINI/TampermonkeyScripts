'use strict';
/**
 * S05 面板可被宿主页面读取(A3) —— 已修复, 本用例锁定修复后的行为
 * ------------------------------------------------------------------
 * 修复前: UI 用 attachShadow({mode:'open'}), 宿主页面脚本可直接穿透 shadowRoot 读出
 * 面板全部内容 —— 33 个站点的清单 + 各站今日签到状态(实测可读)。
 * 修复后: mode:'closed', 宿主页面拿不到 shadowRoot, 但脚本自身仍持有引用, UI 功能不变。
 */

const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert } = require('../lib/sim/tcase');

const HOST = 'http://www.pttime.org';

runCase('S05 宿主页面不得读穿面板(closed shadow)', async () => {
    await withSim(async (sim) => {
        sim.seed({
            ptac_status_tangpt: { date: todayStr(), status: 'success', msg: '预置', ts: Date.now() },
            ptac_status_pttime: { date: todayStr(), status: 'failed', msg: '预置', ts: Date.now() }
        });
        const page = await sim.open(`${HOST}/?sim=already`, { waitMs: 6000 });
        const probe = await page.eval(`
            const root = document.getElementById('ptac-root-v2');
            if (!root) return { found: false };
            // 宿主页面视角: 只能拿到宿主节点本身, shadowRoot 应为 null
            const leaked = [];
            try {
                const sr = root.shadowRoot;
                if (sr) leaked.push('shadowRoot 可读');
            } catch (e) { /* ignore */ }
            return {
                found: true,
                shadowRoot: root.shadowRoot === null ? 'closed' : 'open',
                hostText: (root.textContent || '').trim(),
                leaked
            };
        `);
        assert(probe.found, '未找到面板宿主节点(UI 未注入)');
        assert(probe.shadowRoot === 'closed', `面板 shadow 不是 closed(宿主页面可读取内容), 实际: ${probe.shadowRoot}`);
        assert(!probe.hostText, '宿主节点自身泄漏了面板文本: ' + probe.hostText.slice(0, 80));
        // 宿主节点仍在 DOM 里(说明 UI 功能本身没被砍掉, 只是内容不可读)
        await page.close();
    });
});
