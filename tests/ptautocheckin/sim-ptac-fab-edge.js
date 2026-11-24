'use strict';
/**
 * FAB 靠边模式仿真回归(2026.11.24, 计划 §04 C1/C2/C3)
 * ------------------------------------------------------------------
 * 静态断言(check-ptac-fab-edge.js)钉住源码接线, 本用例在仿真站跑真实 Edge,
 * 验证用户可见行为:
 *
 *   ① 靠边态几何: right/bottom 20, 4x120 竖线, 本体动画关停但辉光保留,
 *      角标数字存在但隐藏, 颜色仍随状态 class;
 *   ② 24px 透明命中区: 竖线左侧的 ::before 外扩区域可被 elementFromPoint 命中;
 *   ③ hover 就地向左侧展开为 52px 圆钮, right/bottom 计算值不变(不跳位),
 *      图标与角标恢复可见;
 *   ④ 点独立 edge 开关: .edge 与 GM ptac_edge 同步切换, 皮肤高亮不变(正交);
 *   ⑤ 跨站: B 站加载即读 ptac_edge=true 显示为竖线态.
 *
 * C4(面板保持展开 / 批量不缩回 / 触屏两段式 / 失焦关闭)是 W4, 本用例不覆盖.
 *
 * shadow 观测: FAB 挂在 closed shadow 下, 页面脚本拿不到 fab 元素;
 *   用 CDP DOM.pierce 穿透读取状态与几何(测试基建特权, 生产代码零改动).
 */

const fs = require('fs');
const path = require('path');
const { withSim, todayStr } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');

const A = 'http://www.tangpt.top';
const B = 'http://b.tangpt.top';
const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');

const HAS_UI = `return !!document.getElementById('ptac-root-v2');`;

// 通过 CDP 穿透 closed shadow 解析出 fab 的远程对象引用
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

// 读 fab 的运行时几何 / 状态 / 可见性
async function fabMetrics(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var b = this.getBoundingClientRect();
            var core = this.querySelector('.fab-core');
            var badge = this.querySelector('.fab-badge');
            return {
                w: b.width, h: b.height, left: b.left, top: b.top,
                right: innerWidth - b.right, bottom: innerHeight - b.bottom,
                cls: this.className,
                coreVis: core ? getComputedStyle(core).visibility : '',
                badgeVis: badge ? getComputedStyle(badge).visibility : '',
                badgeText: badge ? badge.textContent : '',
                anim: getComputedStyle(this).animationName,
                glowAnim: getComputedStyle(this, '::after').animationName,
                bg: getComputedStyle(this).backgroundImage
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

// 程序化点击独立 edge 开关, 读回皮肤高亮以验证正交
async function clickEdge(sim, page) {
    const ref = await resolveFab(sim, page);
    if (!ref) return null;
    const r = await sim.cdp.send('Runtime.callFunctionOn', {
        objectId: ref.objectId,
        functionDeclaration: `function () {
            var sr = this.getRootNode();
            var btn = sr.querySelector('.edge-btn');
            btn.click();
            var active = Array.prototype.slice.call(sr.querySelectorAll('.skin-btn'))
                .filter(function (b) { return b.classList.contains('active'); })
                .map(function (b) { return b.getAttribute('data-skin'); });
            return {
                cls: this.className,
                pressed: btn.getAttribute('aria-pressed'),
                label: btn.textContent,
                active: active
            };
        }`,
        returnByValue: true
    }, ref.sessionId);
    return r && r.result ? r.result.value : null;
}

async function hoverAt(sim, page, x, y) {
    await sim.cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: Math.round(x), y: Math.round(y),
        button: 'none', buttons: 0
    }, page.sessionId);
}

function near(actual, expected, tol, label) {
    assert(Math.abs(actual - expected) <= tol,
        `${label} 应约 ${expected} (容差 ${tol}), 实际 ${actual}`);
}

runCase('FAB 靠边: 竖线几何 / 命中区 / hover 展开 / 正交开关 / 跨站', async () => {
    await withSim(async (sim) => {
        sim.reset();
        // 默认 chameleon 皮肤 + 靠边态: 有未签站(角标数字应存在但被隐藏)
        sim.seed({
            ptac_edge: true,
            ptac_skin: 'chameleon',
            [`ptac_status_tangpt`]: { date: todayStr(), status: 'success', msg: 'sim', ts: Date.now() }
        });
        const page = await sim.open(`${A}/?sim=already`, { waitMs: 1500 });
        await page.waitFor(HAS_UI, 20000, 'UI 注入');

        // ---------- ① 竖线态几何与状态 ----------
        const edge = await fabMetrics(sim, page);
        assert(edge, '应能穿透 shadow 读到 fab 几何');
        assert(/\bedge\b/.test(edge.cls), `靠边态 fab 应带 .edge 类, 实际 ${edge.cls}`);
        near(edge.w, 4, 0.6, '竖线宽');
        near(edge.h, 120, 0.6, '竖线高');
        near(edge.right, 20, 1, '竖线 right');
        near(edge.bottom, 20, 1, '竖线 bottom');
        assertEq(edge.anim, 'none', '竖线态应禁掉 chameleonWave 本体形变');
        assert(edge.glowAnim && edge.glowAnim !== 'none', '竖线态辉光呼吸应保留(颜色跟随状态色)');
        assert(edge.bg.indexOf('gradient') >= 0, '竖线颜色应沿用状态 class 的渐变底');
        assertEq(edge.coreVis, 'hidden', '竖线态隐藏图标');
        assertEq(edge.badgeVis, 'hidden', '竖线态隐藏角标数字');
        assert(Number(edge.badgeText) > 0, '竖线态底层角标数字应仍存在(仅视觉隐藏)');

        // ---------- ② 24px 透明命中区 ----------
        // 探测点取竖线左侧外扩区(::before: left -20px, width 24px), 避开本体 4px;
        // 纵向取偏下位置, 使 hover 展开为 52px 圆钮后指针仍落在按钮内, 不触发抖动回缩.
        const px = Math.round(edge.left - 10);
        const py = Math.round(edge.top + 100);
        assertEq(await page.eval(`var el = document.elementFromPoint(${px}, ${py});
            return !!(el && el.id === 'ptac-root-v2');`), true,
            `命中区探测点(${px},${py})应命中 UI 宿主(24px 透明命中区)`);

        // ---------- ③ hover 就地展开 ----------
        await hoverAt(sim, page, px, py);
        await sim.sleep(400); // 等待 width/height 0.18s 过渡收敛
        const expanded = await fabMetrics(sim, page);
        assert(expanded, '展开后应能读到 fab 几何');
        near(expanded.w, 52, 1, '展开宽');
        near(expanded.h, 52, 1, '展开高');
        near(expanded.right, 20, 1, '展开 right(不跳位)');
        near(expanded.bottom, 20, 1, '展开 bottom(不跳位)');
        assert(/\bedge\b/.test(expanded.cls), '展开只是 hover 形变, .edge 类仍在');
        assertEq(expanded.coreVis, 'visible', '展开态恢复图标');
        assertEq(expanded.badgeVis, 'visible', '展开态恢复角标数字');

        // ---------- ④ 正交开关: 切换靠边不动皮肤 ----------
        const off = await clickEdge(sim, page);
        assert(off, '应能读到点击开关后的状态');
        assert(!/\bedge\b/.test(off.cls), `关闭靠边应移除 .edge 类, 实际 ${off.cls}`);
        assertEq(off.pressed, 'false', '关闭后 aria-pressed 应为 false');
        assertEq(off.label, '展开', '关闭后按钮文案应为展开');
        assertEq(off.active.join(','), 'chameleon', '切换靠边不应重置皮肤高亮');
        assertEq(sim.get('ptac_edge'), false, 'GM ptac_edge 应持久化为 false');

        const on = await clickEdge(sim, page);
        assert(on, '应能读到再次点击开关后的状态');
        assert(/\bedge\b/.test(on.cls), '再次开启应恢复 .edge 类');
        assertEq(on.pressed, 'true', '开启后 aria-pressed 应为 true');
        assertEq(on.label, '靠边', '开启后按钮文案应为靠边');
        assertEq(on.active.join(','), 'chameleon', '再次切换仍不动皮肤高亮');
        assertEq(sim.get('ptac_edge'), true, 'GM ptac_edge 应持久化为 true');
        await page.close();

        // ---------- ⑤ 跨站: B 站加载即竖线态 ----------
        const pageB = await sim.open(`${B}/?sim=already`, { waitMs: 1500 });
        await pageB.waitFor(HAS_UI, 20000, 'B 站 UI 注入');
        const cross = await fabMetrics(sim, pageB);
        assert(cross, 'B 站应能读到 fab 几何');
        assert(/\bedge\b/.test(cross.cls),
            `B 站加载应直接是竖线态(ptac_edge 跨站), 实际 cls=${cross.cls}, GM=${JSON.stringify(sim.get('ptac_edge'))}, w=${cross.w}`);
        near(cross.w, 4, 0.6, 'B 站竖线宽');
        near(cross.h, 120, 0.6, 'B 站竖线高');
        await pageB.close();
    });
});
