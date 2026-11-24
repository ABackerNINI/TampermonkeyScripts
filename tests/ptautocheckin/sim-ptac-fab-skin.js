'use strict';
/**
 * FAB 皮肤 2 钮与 legacy 静默归一仿真回归(2026.11.24, 计划 fix2 §04 A1/A4)
 * ------------------------------------------------------------------
 * 静态断言(check-ptac-fab-skin.js)只能钉住源码接线, 证明不了运行时真的渲染正确。
 * 本用例在仿真站里跑真实 Edge, 验证用户可见行为:
 *
 *   ① legacy ptac_skin=static 全完成态: 渲染变色(绿底无角标)、active 落变色钮,
 *      动效开关初始化为关(本体/辉光动画=none, host 挂 .motion-off, 文案「静态」),
 *      GM ptac_skin 仍为 static、ptac_motion 未回写(D8 静默迁移);
 *   ② legacy static 有未签态与 chameleon 在同等今日汇总下状态色/角标/主区内容逐态一致;
 *   ③ legacy ptac_skin=number|ring 注入后渲染为变色且 active 高亮落在变色钮,
 *      GM 存储值仍是原 legacy 串(不回写), 动效保持默认开;
 *   ④ signal 皮肤失败态仍显示感叹号(.mark), 确认清理未误伤信号灯。
 *
 * shadow 观测: 面板与 FAB 挂在 closed shadow 下, 页面脚本拿不到 fab 元素。
 *   命中测试(elementFromPoint)会进入 shadow 并把结果重定向成宿主 #ptac-root-v2,
 *   可证 UI 已挂载并覆盖 FAB 点; 具体 class/角标/动画则用 CDP DOM.pierce 穿透
 *   closed shadow 读取(测试基建特权, 生产代码零改动)。
 */

const fs = require('fs');
const path = require('path');
const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq, waitStore } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const UID = 'tangpt';
const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');

const HAS_UI = `return !!document.getElementById('ptac-root-v2');`;
// elementFromPoint 的 shadow 重定向: 该点落在 FAB(52px, right:20/bottom:20)内,
// 命中结果应是 UI 宿主; 面板收起时该点不会被其他 UI 覆盖。
// 命中前先用 CDP 读 fab 矩形断言探测点确实在矩形内(README P70: 先前置状态再断言命中),
// 避免 FAB 移位或尺寸变化后命中测试仍"恰好"落到宿主而失去定位意义。
const FAB_HIT = `var el = document.elementFromPoint(Math.round(innerWidth - 46), Math.round(innerHeight - 46));
    return !!(el && el.id === 'ptac-root-v2');`;

// 通过 CDP 穿透 closed shadow 解析出 fab 的远程对象引用(状态与几何共用)
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

// 读 fab 的 getBoundingClientRect, 作为命中测试的前置几何断言依据
async function fabRect(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var b = this.getBoundingClientRect();
            return { left: b.left, top: b.top, right: b.right, bottom: b.bottom,
                     cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

// 通过 CDP 穿透 closed shadow 读取 fab 的运行时状态
async function fabState(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const s = ref.sessionId;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var sr = this.getRootNode();
            var badge = this.querySelector('.fab-badge');
            var core = this.querySelector('.fab-core');
            var active = Array.prototype.slice.call(sr.querySelectorAll('.skin-btn'))
                .filter(function (b) { return b.classList.contains('active'); })
                .map(function (b) { return b.getAttribute('data-skin'); });
            var hostEl = document.getElementById('ptac-root-v2');
            var motionBtn = sr.querySelector('.motion-btn');
            return {
                cls: this.className,
                core: core ? core.innerHTML : '',
                badge: badge ? badge.textContent : '',
                badgeCls: badge ? badge.className : '',
                anim: getComputedStyle(this).animationName,
                animAfter: getComputedStyle(this, '::after').animationName,
                active: active,
                hostCls: hostEl ? hostEl.className : '',
                motionPressed: motionBtn ? motionBtn.getAttribute('aria-pressed') : '',
                motionLabel: motionBtn ? motionBtn.textContent : ''
            };
        }`,
        returnByValue: true
    }, s);
    return r && r.result ? r.result.value : null;
}

async function openSite(sim, scenario) {
    const page = await sim.open(`${A}/?sim=${scenario}`, { waitMs: 1500 });
    await page.waitFor(HAS_UI, 20000, 'UI 注入');
    // 前置几何: 探测点须落在 fab 矩形内, 之后 elementFromPoint 命中断言才有意义
    const rect = await fabRect(sim, page);
    assert(rect, '应能穿透 shadow 读到 fab 矩形');
    const vp = await page.eval('return { w: innerWidth, h: innerHeight };');
    const px = Math.round(vp.w - 46);
    const py = Math.round(vp.h - 46);
    assert(px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom,
        `探测点(${px},${py})应落在 fab 矩形内(实际 ${JSON.stringify(rect)})`);
    assertEq(await page.eval(FAB_HIT), true, 'FAB 点命中测试应重定向到 UI 宿主');
    await waitStore(sim, `ptac_status_${UID}`, (v) => v && v.status === 'success',
        20000, '已签页应判成功');
    return page;
}

// 归一化 class 顺序后比较, 避免 style 增删顺序差异造成误判
function normCls(cls) {
    return String(cls).split(/\s+/).filter(Boolean).sort().join(' ');
}

runCase('FAB 皮肤: legacy static/number/ring 静默归一为变色', async () => {
    const src = fs.readFileSync(SRC, 'utf8');
    const ids = Array.from(new Set(
        Array.from(src.matchAll(/\bid:\s*'([^']+)'/g)).map((m) => m[1])));
    const allSuccess = {};
    for (const id of ids) {
        allSuccess[`ptac_status_${id}`] =
            { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() };
    }

    await withSim(async (sim) => {
        // ---------- ① legacy static 全完成态(D8 静默迁移) ----------
        sim.reset();
        sim.seed(Object.assign({ ptac_skin: 'static' }, allSuccess));
        let page = await openSite(sim, 'already');
        let st = await fabState(sim, page);
        assert(st, '应能穿透 shadow 读到 fab 状态');
        assert(/\bchameleon\b/.test(st.cls), 'legacy static 应归一渲染为变色(.chameleon)');
        assert(!/\bstatic\b/.test(st.cls), 'legacy static 不应残留 .static 类');
        assert(/\bok\b/.test(st.cls), '全完成应为绿底(.ok)');
        assertEq(st.badge, '', '全完成无角标数字');
        assert(st.badgeCls.indexOf('show') < 0, '全完成角标应隐藏');
        assertEq(st.anim, 'none', 'legacy static 动效应关停(本体)');
        assertEq(st.animAfter, 'none', 'legacy static 动效应关停(辉光)');
        assertEq(st.active.join(','), 'chameleon', 'active 高亮应落变色钮');
        assert(/\bmotion-off\b/.test(st.hostCls), 'legacy static 应给 host 挂 .motion-off');
        assertEq(st.motionPressed, 'false', '动效开关初始化为关');
        assertEq(st.motionLabel, '静态', '动效文案应为「静态」');
        assertEq(sim.get('ptac_skin'), 'static', 'GM ptac_skin 应保留 legacy 原值, 不回写');
        assert(sim.get('ptac_motion') === undefined, 'GM ptac_motion 不应被静默迁移回写');
        await page.close();

        // ---------- ② legacy static 有未签态 + 与变色逐态一致 ----------
        sim.reset();
        sim.seed({ ptac_skin: 'static' });
        page = await openSite(sim, 'already');
        st = await fabState(sim, page);
        assert(/\bchameleon\b/.test(st.cls), '有未签时归一渲染为变色');
        assert(!/\bok\b/.test(st.cls), '有未签不应是绿底(.ok)');
        assert(st.badgeCls.indexOf('show') >= 0, '有未签应显示角标');
        assert(st.badgeCls.indexOf('err') >= 0, '有未签角标应为红(err)');
        assert(Number(st.badge) > 0, '角标数字应为剩余站数');
        assertEq(st.anim, 'none', '有未签时本体动画仍应关停(动效开关为关)');
        assertEq(st.animAfter, 'none', '有未签时辉光动画仍应关停');
        const legacyStaticState = st;
        await page.close();

        sim.reset();
        sim.seed({ ptac_skin: 'chameleon' });
        page = await openSite(sim, 'already');
        const ch = await fabState(sim, page);
        assert(ch, '应能读到变色皮肤的 fab 状态');
        assertEq(legacyStaticState.badge, ch.badge, 'legacy static 角标数字应与变色一致');
        assertEq(legacyStaticState.badgeCls, ch.badgeCls, 'legacy static 角标样式应与变色一致');
        assertEq(legacyStaticState.core, ch.core, 'legacy static 主区内容应与变色一致');
        assertEq(normCls(legacyStaticState.cls), normCls(ch.cls), 'legacy static 归一后 class 应与变色一致');
        assert(ch.animAfter !== 'none', '变色皮肤辉光动画应开启(与 legacy static 形成对照)');
        assertEq(ch.motionPressed, 'true', '非 legacy static 时动效默认开');
        await page.close();

        // ---------- ③ legacy number/ring 归一(动效保持默认开) ----------
        for (const legacy of ['number', 'ring']) {
            sim.reset();
            sim.seed({ ptac_skin: legacy });
            page = await openSite(sim, 'already');
            st = await fabState(sim, page);
            assert(/\bchameleon\b/.test(st.cls), `${legacy} 应渲染为变色`);
            assert(st.core.indexOf('ring-rays') < 0, `${legacy} 不应残留射线 DOM`);
            assert(!/\bstatic\b/.test(st.cls), `${legacy} 不应残留 static 类`);
            assertEq(st.active.join(','), 'chameleon', `${legacy} 的 active 高亮应落在变色钮`);
            assertEq(st.motionPressed, 'true', `${legacy} 动效应保持默认开`);
            assertEq(sim.get('ptac_skin'), legacy, 'GM 值应保留 legacy 原串, 不回写');
            await page.close();
        }

        // ---------- ④ signal 失败态未被皮肤清理误伤 ----------
        sim.reset();
        sim.seed({
            ptac_skin: 'signal',
            [`ptac_status_pttime`]:
                { date: todayStr(), status: 'failed', msg: 'sim', ts: Date.now() }
        });
        page = await openSite(sim, 'already');
        st = await fabState(sim, page);
        assert(/\berr\b/.test(st.cls), 'signal 今日有失败应为红底(.err)');
        assert(/class="mark"/.test(st.core), 'signal 失败态主区应为感叹号(.mark)');
        assertEq(st.active.join(','), 'signal', 'signal 高亮应落在信号灯钮');
        await page.close();
    });
});
