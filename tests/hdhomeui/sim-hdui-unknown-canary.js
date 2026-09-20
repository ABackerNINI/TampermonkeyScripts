#!/usr/bin/env node
'use strict';
/**
 * 仿真: 未知元素「金丝雀」—— 站点改版冒出来的东西, 一个都不许消失
 * ------------------------------------------------------------------
 * 为什么单独一个用例:
 *   既有 12 个 hdui 用例**全是正向断言**(骨架特征存在 / 已知元素画得对 / 已知功能还在),
 *   没有任何一条在问"页面上那些**我不认识**的东西还在不在"。
 *   而 HDHomeUI 是纯 CSS 层 —— 它屏蔽一个元素不需要 `display:none`, 只要:
 *     · 把它的 background-image 清成 none(类别/促销图标: 变成空白方块)
 *     · 用 overflow 把它裁掉、用 z-index 把它压住、用 contain 把它挪出视口
 *     · 把底压深却不管**写死的前景色**(公告的黑字黑底: 内容还在, 人看不见)
 *   这四种都算"屏蔽", 而且矩形非零、DOM 还在 —— 只看"元素是否存在"根本抓不到。
 *
 * 判据(每条金丝雀都要过):
 *   ① 还在 DOM 里 ② 面积 ≥ 8×8(不是被压成一条线/一个点) ③ display/visibility/opacity 可见
 *   ④ **hit-test 命中自身**(防被裁 / 被压 / 跑到视口外 —— 这一条最硬)
 *   ⑤ 对比度够(防"软屏蔽": 字还在, 但和底色一样暗) ⑥ 图标类必须有可见内容(防被清成空白)
 *   ⑦ 面积不低于**不上妆对照组**的 60%(上妆不许把东西缩小)
 *   ⑧ 加了这些未知元素之后**不许卸妆**(不能因为不认识就整个退掉)
 *
 * ⚠️ 对照组必须在**同一次 withSim 会话**里量: 两次会话的字体/滚动条不同, 尺寸比较没有意义。
 *
 * 反向验证(写完必做):
 *   · 删掉 iconCss 的 `img[class*="c_"]` 兜底 => icon-unknown-cat 红
 *   · 删掉 FONT_BLACK 救援 => ann-bgcolor / ann-inline 红(对比度)
 *   · 把 `#torrenttable` 的 contain 改成 `contain:paint` => popup-fixed-in-table 红
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');
const scan = require('../lib/hdui-scan');

/** 加载期就存在的未知元素(仿真页 hdhome-ui-unknown 自带) */
const LOAD_IDS = [
    'ann-bgcolor', 'ann-inline', 'ann-marquee',
    'tag-unknown', 'badge-unknown', 'icon-unknown-cat', 'icon-unknown-pro'
];

/** 运行期注入: 站点**动态**冒出来的东西(消息弹窗最典型) */
const RUNTIME_IDS = [
    'popup-fixed', 'popup-fixed-in-table', 'tip-absolute', 'iframe-unknown', 'badge-inline'
];

const INJECT = [
    '(function () {',
    '  function mk(tag, css, id, html) {',
    '    const e = document.createElement(tag);',
    '    e.setAttribute("data-canary", id);',
    '    e.style.cssText = css;',
    '    if (html) e.innerHTML = html;',
    '    return e;',
    '  }',
    // ① 站内消息弹窗(站点最典型的动态浮层): 白底黑字、居中、高层级、带一个可点的关闭按钮
    '  document.body.appendChild(mk("div", "position:fixed;left:50%;top:50%;'
    + 'transform:translate(-50%,-50%);width:320px;height:160px;background:#fff;color:#000;'
    + 'z-index:9999;padding:12px;box-sizing:border-box", "popup-fixed",'
    + ' "<b>你有一条新消息</b><button id=\\"canary-close\\" style=\\"margin-top:8px\\">关闭</button>"));',
    // ② 同一个弹窗, 但挂在 #torrenttable **里面** —— 专测 contain 把 fixed 的定位基准改掉。
    //    ⚠️ 位置要跟 ① 岔开: 两个浮层叠在一起时, 上面那个会把下面那个"挡住",
    //    那是浮层该有的行为, 不是本用例要抓的"屏蔽"(实测踩过一次)。
    '  const t = document.getElementById("torrenttable");',
    '  if (t) t.appendChild(mk("div", "position:fixed;left:12px;top:12px;width:280px;'
    + 'height:120px;background:#fff;color:#000;z-index:9998",'
    + ' "popup-fixed-in-table", "<b>表内弹窗</b>"));',
    // ③ hover 提示框(站点 DomTT 那类, 平时隐藏, hover 时才冒出来)
    //    ⚠️ 位置与其它浮层**必须岔开**: 浮层互相遮挡是它们该有的行为,
    //    混在一起就分不清"被主题屏蔽"和"被自己注入的弹窗挡住"了。
    '  document.body.appendChild(mk("div", "position:absolute;left:400px;top:8px;width:220px;'
    + 'height:56px;background:#333;color:#fff;z-index:500;padding:6px",'
    + ' "tip-absolute", "<b>提示: 这是新功能</b>"));',
    '  const outer = document.getElementById("outer");',
    '  if (outer) {',
    // ④ 站点嵌的 iframe(公告/视频那种)。
    //    ⚠️ 必须插在**容器开头**而不是末尾: 插末尾时它在页面很下方, __hit 会 scrollIntoView
    //    把它滚到**视口正中**, 正好撞上 ① 那个居中的 fixed 弹窗 —— 于是 hit-test 命中的是弹窗。
    //    (Windows 上页面滚不到底、iframe 落在弹窗下方, 本地"侥幸通过"; Linux CI 字体度量不同
    //    就能滚到位, 于是红 —— 本地绿不代表判据稳。)
    '    const fr = mk("iframe", "width:240px;height:140px;border:0", "iframe-unknown");',
    '    fr.setAttribute("src", "about:blank");',
    '    outer.insertBefore(fr, outer.firstChild);',
    // ⑤ 标题格里的行内新徽章(站点最爱往标题后面加东西)
    '    const cell = document.querySelector("#torrenttable td.rowfollow table.torrentname td.embedded");',
    '    if (cell) cell.appendChild(mk("b", "display:inline-block;padding:2px 6px;background:#c0392b;'
    + 'color:#fff;border-radius:4px;font-size:10px", "badge-inline", "NEW"));',
    '  }',
    '  return true;',
    '})()'
].join('\n');

/** 逐条断言一只金丝雀「还看得见」 */
function checkOne(c, id, opt) {
    const o = opt || {};
    assert(c && c.exists, '[' + id + '] 还在 DOM 里');
    assert(c.w >= 8 && c.h >= 8, '[' + id + '] 面积没有被压没(实测 ' + c.w + 'x' + c.h + ', 要求 ≥ 8x8)');
    assert(c.display !== 'none', '[' + id + '] display 不是 none(实测 ' + c.display + ')');
    assert(c.visibility === 'visible', '[' + id + '] visibility 是 visible(实测 ' + c.visibility + ')');
    assert(c.opacity > 0.1, '[' + id + '] opacity 可见(实测 ' + c.opacity + ')');
    assert(c.hitOk, '[' + id + '] hit-test 命中自身(没被裁/没被压/没跑出视口); 实测命中: '
        + (c.hit || c.hitWhy) + ' @ ' + c.x + ',' + c.y);
    // ⚠️ 阈值取 40(与真站对比度扫描同一口径): 取 20 的话"纯黑字压在深色片基上"
    //    (亮度 0 vs 22, 差 22)会被判成合格 —— 而那正是最典型的"软屏蔽"。
    if (o.text !== false) {
        assert(c.contrast !== null && c.contrast >= 40,
            '[' + id + '] 前景与背景亮度差 ≥ 40(实测 ' + c.contrast + ') —— 防"字还在但看不见"');
    }
    // ⚠️ 不能只判"不是 none": 站点雪碧图也是"不是 none", 看不出到底换没换成主题图标。
    //    直接要求**至少一层是内联 SVG** —— 这才等价于"未知图标也有兜底图形, 不会变空白"。
    if (o.icon) {
        const isSvg = function (v) {
            return typeof v === 'string' && v.indexOf('data:image/svg+xml') >= 0;
        };
        assert(isSvg(c.icon.content) || isSvg(c.icon.bg),
            '[' + id + '] 未知图标也换成了主题 SVG(content/background 至少一层是内联 SVG); 实测 content='
            + String(c.icon.content).slice(0, 46) + ' bg=' + String(c.icon.bg).slice(0, 46));
    }
}

/** 非种子页上会出现的那几只（`#torrenttable` 不存在, 表内那两只注入不出来） */
const NOTABLE_IDS = [
    'ann-bgcolor', 'ann-inline', 'ann-marquee', 'popup-fixed', 'tip-absolute', 'iframe-unknown'
];

async function openAs(sim, theme, scenario) {
    const page = await H.open(sim, scenario || 'hdhome-ui-unknown');
    await page.waitFor('return document.documentElement.dataset.hduiState === '
        + JSON.stringify(theme === 'default' ? 'off' : 'applied'), 15000, 'state=' + theme);
    return page;
}

runCase('HDHomeUI · 未知元素金丝雀(公告 / 弹窗 / 新标签一律不许消失)', async function () {
    await withSim(async function (sim) {
        const ids = LOAD_IDS.concat(RUNTIME_IDS);

        // ---- 对照组: 不上妆(原站界面)时这些元素长什么样 ----
        sim.seed({ 'hdui.theme': 'default' });
        const p0 = await openAs(sim, 'default');
        const base = Object.assign({}, await scan.canaries(p0, LOAD_IDS));
        await p0.eval(INJECT);
        Object.assign(base, await scan.canaries(p0, RUNTIME_IDS));
        await p0.close();

        // ---- 实验组: 上妆 ----
        sim.seed({ 'hdui.theme': 'film' });
        const page = await openAs(sim, 'film');

        // A 组: 加载期就存在的未知元素(**注入之前**量, 免得被自己注入的浮层盖住)
        const load = await scan.canaries(page, LOAD_IDS);
        LOAD_IDS.forEach(function (id) {
            checkOne(load[id], id, { icon: /^icon-/.test(id), text: !/^icon-/.test(id) });
        });

        // B 组: 运行期动态冒出来的
        await page.eval(INJECT);
        await new Promise(function (r) { setTimeout(r, 900); });  // 结构守卫有 500ms 防抖
        const run = await scan.canaries(page, RUNTIME_IDS);
        RUNTIME_IDS.forEach(function (id) {
            checkOne(run[id], id, { text: !/^iframe/.test(id) });
        });
        const got = Object.assign({}, load, run);

        // ⑧ 加了这些未知元素之后不许卸妆
        const st = await page.eval('return { state: document.documentElement.dataset.hduiState,'
            + ' theme: document.documentElement.dataset.hduiTheme };');
        assert(st.state === 'applied' && st.theme === 'film',
            '注入未知元素后仍是已上妆状态(不因为"不认识"就整体退掉); 实测 ' + JSON.stringify(st));

        // ---- C 组: 非种子页(我的 / 论坛 / 详情页) ----
        // 主题的 `[bgcolor]` / inline 白底 / `font[color]` 三条兜底都是**全局规则**,
        // 在没有种子表的页面上一样生效 ⇒ 公告与弹窗在这里的风险一点都不少, 不能只测种子页。
        const p7 = await openAs(sim, 'film', 'hdhome-ui-unknown-notable');
        const load7 = await scan.canaries(p7, ['ann-bgcolor', 'ann-inline', 'ann-marquee']);
        ['ann-bgcolor', 'ann-inline', 'ann-marquee'].forEach(function (id) {
            checkOne(load7[id], id, {});
        });
        await p7.eval(INJECT);
        await new Promise(function (r) { setTimeout(r, 700); });
        const run7 = await scan.canaries(p7, ['popup-fixed', 'tip-absolute', 'iframe-unknown']);
        ['popup-fixed', 'tip-absolute'].forEach(function (id) { checkOne(run7[id], id, {}); });
        checkOne(run7['iframe-unknown'], 'iframe-unknown', { text: false });
        const st7 = await p7.eval('return document.documentElement.dataset.hduiState;');
        assert(st7 === 'applied', '非种子页上注入未知元素后仍是已上妆状态; 实测 ' + st7);
        await p7.close();

        // ⑦ 上妆不许把东西缩小
        ids.forEach(function (id) {
            const b = base[id], t = got[id];
            assert(b && b.exists, '[' + id + '] 对照组量到了');
            assert(t && t.exists, '[' + id + '] 实验组量到了');
            const ab = b.w * b.h, at = t.w * t.h;
            assert(at >= ab * 0.6,
                '[' + id + '] 上妆后面积不低于对照的 60%(对照 ' + b.w + 'x' + b.h
                + ' -> 上妆 ' + t.w + 'x' + t.h + ')');
        });

        await page.close();
    }, { scriptPath: H.HDUI_PATH });
});
