'use strict';
/**
 * FAB 动效开关仿真回归(2026.11.24, 计划 fix2 §04 A2/A3, §06 D1/D2/D8)
 * ------------------------------------------------------------------
 * 静态断言(check-ptac-fab-motion.js)钉住源码接线, 本用例在仿真站跑真实 Edge,
 * 验证关动效在 closed shadow 下真的停掉动画, 且两个布尔开关与皮肤正交:
 *
 *   ① 默认开: FAB 本体/辉光 animation 非 none, 按钮 aria-pressed=true、文案「动效」,
 *      host 无 .motion-off;
 *   ② seed ptac_motion=false: 本体/辉光 animation=none, host 挂 .motion-off,
 *      按钮 aria-pressed=false、文案「静态」, 皮肤高亮与靠边态不受影响;
 *   ③ 点动效钮: 运行时切关/开, GM ptac_motion 同步持久化, 皮肤高亮与靠边 aria-pressed 不变;
 *   ④ 跨站: B 站加载读到同一 ptac_motion 值;
 *   ⑤ 组合态: 关动效 + 靠边同时生效, 互不重置; legacy static 的静默迁移另见 sim-ptac-fab-skin.js。
 *
 * shadow 观测: 面板与 FAB 挂在 closed shadow 下, 用 CDP DOM.pierce 穿透读运行时状态,
 *   宿主 class 从 light DOM 直接读; 测试基建特权, 生产代码零改动。
 */

const path = require('path');
const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const B = 'http://b.tangpt.top';
const UID = 'tangpt';
const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');

const HAS_UI = `return !!document.getElementById('ptac-root-v2');`;

// 通过 CDP 穿透 closed shadow 解析 fab 的远程对象引用
async function resolveFab(sim, page) {
    const s = page.sessionId;
    const doc = await sim.cdp.send('DOM.getDocument', { depth: 1, pierce: true }, s);
    const host = await sim.cdp.send('DOM.querySelector',
        { nodeId: doc.root.nodeId, selector: '#ptac-root-v2' }, s);
    if (!host.nodeId) return null;
    const desc = await sim.cdp.send('DOM.describeNode',
        { nodeId: host.nodeId, pierce: true, depth: -1 }, s);
    const roots = (desc.node && desc.node.shadowRoots) || [];
    if (!roots.length) return null;
    const fab = await sim.cdp.send('DOM.querySelector',
        { nodeId: roots[0].nodeId, selector: '.fab' }, s);
    if (!fab.nodeId) return null;
    const obj = await sim.cdp.send('DOM.resolveNode', { nodeId: fab.nodeId }, s);
    return { sessionId: s, objectId: obj.object.objectId };
}

// 读动效/皮肤/靠边三项正交状态
async function motionState(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var sr = this.getRootNode();
            var hostEl = document.getElementById('ptac-root-v2');
            var motionBtn = sr.querySelector('.motion-btn');
            var edgeBtn = sr.querySelector('.edge-btn');
            var active = Array.prototype.slice.call(sr.querySelectorAll('.skin-btn'))
                .filter(function (b) { return b.classList.contains('active'); })
                .map(function (b) { return b.getAttribute('data-skin'); });
            return {
                cls: this.className,
                anim: getComputedStyle(this).animationName,
                animAfter: getComputedStyle(this, '::after').animationName,
                hostCls: hostEl ? hostEl.className : '',
                motionPressed: motionBtn ? motionBtn.getAttribute('aria-pressed') : '',
                motionLabel: motionBtn ? motionBtn.textContent : '',
                edgePressed: edgeBtn ? edgeBtn.getAttribute('aria-pressed') : '',
                active: active
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

// 程序化点击 shadow 内的动效钮, 读回三项状态确认正交
async function clickMotion(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var sr = this.getRootNode();
            var btn = sr.querySelector('.motion-btn');
            btn.click();
            var hostEl = document.getElementById('ptac-root-v2');
            var edgeBtn = sr.querySelector('.edge-btn');
            var active = Array.prototype.slice.call(sr.querySelectorAll('.skin-btn'))
                .filter(function (b) { return b.classList.contains('active'); })
                .map(function (b) { return b.getAttribute('data-skin'); });
            return {
                cls: this.className,
                anim: getComputedStyle(this).animationName,
                animAfter: getComputedStyle(this, '::after').animationName,
                hostCls: hostEl ? hostEl.className : '',
                motionPressed: btn.getAttribute('aria-pressed'),
                motionLabel: btn.textContent,
                edgePressed: edgeBtn ? edgeBtn.getAttribute('aria-pressed') : '',
                active: active
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

async function openSite(sim, origin) {
    const page = await sim.open(`${origin}/?sim=already`, { waitMs: 1500 });
    await page.waitFor(HAS_UI, 20000, 'UI 注入');
    return page;
}

runCase('FAB 动效开关: 三类动画关停 + 两开关正交 + 跨站持久', async () => {
    await withSim(async (sim) => {
        // ---------- ① 默认开 ----------
        sim.reset();
        sim.seed({ ptac_skin: 'chameleon',
            [`ptac_status_${UID}`]: { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() } });
        let page = await openSite(sim, A);
        let st = await motionState(sim, page);
        assert(st, '应能穿透 shadow 读到动效状态');
        assert(st.hostCls.indexOf('motion-off') < 0, '默认开时 host 不应挂 .motion-off');
        assertEq(st.motionPressed, 'true', '默认开时 aria-pressed=true');
        assertEq(st.motionLabel, '动效', '默认开时文案「动效」');
        assert(st.anim !== 'none' && st.anim !== undefined, '默认开时本体动画应运行');
        assert(st.animAfter !== 'none', '默认开时辉光动画应运行');
        assertEq(st.edgePressed, 'false', '默认靠边关');
        assertEq(st.active.join(','), 'chameleon', '默认皮肤高亮变色');

        // ---------- ③ 点动效钮: 切关 + 正交 ----------
        let clicked = await clickMotion(sim, page);
        assert(clicked, '点击动效钮后应能读到状态');
        assertEq(clicked.motionPressed, 'false', '点击后动效 aria-pressed=false');
        assertEq(clicked.motionLabel, '静态', '点击后文案「静态」');
        assert(clicked.hostCls.indexOf('motion-off') >= 0, '点击后 host 挂 .motion-off');
        assertEq(clicked.anim, 'none', '点击后本体动画 animation=none');
        assertEq(clicked.animAfter, 'none', '点击后辉光动画 animation=none');
        assertEq(sim.get('ptac_motion'), false, '点击应持久化 ptac_motion=false');
        assertEq(clicked.active.join(','), 'chameleon', '切动效不重置皮肤高亮');
        assertEq(clicked.edgePressed, 'false', '切动效不重置靠边开关');

        // 再点一次恢复开
        clicked = await clickMotion(sim, page);
        assertEq(clicked.motionPressed, 'true', '再点后动效恢复开');
        assert(clicked.animAfter !== 'none', '再点后辉光动画恢复');
        assertEq(sim.get('ptac_motion'), true, '再点持久化 ptac_motion=true');
        await page.close();

        // ---------- ② seed 关: 初始化即关, 不影响皮肤/靠边 ----------
        sim.reset();
        sim.seed({ ptac_skin: 'signal', ptac_motion: false, ptac_edge: true,
            [`ptac_status_${UID}`]: { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() } });
        page = await openSite(sim, A);
        st = await motionState(sim, page);
        assert(st, '应能读到 seed 关动效后的状态');
        assert(st.hostCls.indexOf('motion-off') >= 0, 'seed 关时 host 挂 .motion-off');
        assertEq(st.motionPressed, 'false', 'seed 关时按钮 aria-pressed=false');
        assertEq(st.motionLabel, '静态', 'seed 关时文案「静态」');
        assertEq(st.anim, 'none', 'seed 关时本体 animation=none');
        assertEq(st.animAfter, 'none', 'seed 关时辉光 animation=none');
        assertEq(st.edgePressed, 'true', '关动效不重置靠边(仍为真)');
        assert(st.cls.indexOf('edge') >= 0, '靠边 .edge 类仍在');
        assertEq(st.active.join(','), 'signal', '关动效不重置皮肤(signal 高亮仍在)');
        assertEq(sim.get('ptac_motion'), false, '初始化只读 GM, 不回写 ptac_motion');

        // ---------- ④ 跨站读到同值 ----------
        const pageB = await openSite(sim, B);
        const cross = await motionState(sim, pageB);
        assert(cross, 'B 站应能读到动效状态');
        assertEq(cross.motionPressed, 'false', 'B 站应读到同一 ptac_motion=false');
        assert(cross.hostCls.indexOf('motion-off') >= 0, 'B 站 host 同样挂 .motion-off');
        assertEq(cross.anim, 'none', 'B 站本体动画同样关停');
        assertEq(cross.active.join(','), 'signal', 'B 站皮肤高亮同为 signal');
        await pageB.close();
        await page.close();
    });
});
