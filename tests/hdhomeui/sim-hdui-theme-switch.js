#!/usr/bin/env node
'use strict';
/**
 * 仿真: 胶片墙上妆、骨架特征、切回默认、记忆与快捷键
 * ------------------------------------------------------------------
 * 旧版断言「5 套主题的版式签名两两不同」; 现在只有一套主题, 那个断言失去意义,
 * 改为**逐条钉死胶片墙的骨架特征** —— 齿孔轨道 / 帧号 / 吸顶片头 / 做种占比条,
 * 少任何一条就不叫胶片墙(防止哪次改动把它悄悄改回普通列表)。
 */

const { withSim } = require('../lib/sim/harness');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');
const H = require('../lib/hdui-help');

const THEMES = ['film'];
const ALL_IDS = ['default'].concat(THEMES);

runCase('HDHomeUI · 胶片墙上妆 / 骨架特征 / 记忆', async function () {
    await withSim(async function (sim) {
        // ---- 上妆胶片墙, 收集版式签名 + 骨架探针 ----
        sim.seed({ 'hdui.theme': 'film' });
        const page = await H.open(sim, 'hdhome-ui');
        await H.waitState(page, 'applied');
        assertEq(await H.themeOf(page), 'film', '胶片墙已生效');

        const sig = await H.signature(page);
        assert(!!sig, '取到版式签名');
        assertEq(sig.table, 'block', '片基: 表格摊平成块(不再有 table 语义)');
        assertEq(sig.tbody, 'flex', '片基: 表体纵向 flex —— 一帧一行, 左右留齿孔轨道');
        assertEq(sig.row, 'flex', '帧: 行是横向 flex 长条');
        assertEq(sig.seedFont, '20px', '做种数 20px —— 这一屏唯一的视觉锚点');
        assert(/^#[0-9a-f]{6}$/i.test(sig.cat), '写入了类别色: ' + sig.cat);
        assert(sig.ratio !== '', '写入了做种占比(--hdui-ratio)');

        // 运行时探针: 齿孔 / 帧号 / 吸顶片头 / 中文栏名 / 置顶金条 / 占比条
        const frame = await page.eval([
            'const t = document.getElementById("torrenttable");',
            'const tb = t.tBodies[0];',
            'const rows = Array.prototype.slice.call(tb.rows);',
            'const head = rows[0];',
            'const row = rows[1];',
            'const labels = Array.prototype.slice.call(head.cells).map(function (c) {',
            '  const a = c.querySelector("a");',
            '  return a ? getComputedStyle(a, "::after").content : "";',
            '});',
            'const sticky = rows.filter(function (r) { return /sticky_top/.test(r.className || ""); });',
            'const seedCell = row.cells[5];',
            'return {',
            '  holeBefore: getComputedStyle(tb, "::before").backgroundImage,',
            '  holeAfter: getComputedStyle(tb, "::after").backgroundImage,',
            '  frameNo: getComputedStyle(row, "::before").content,',
            '  headPos: getComputedStyle(head).position,',
            '  labels: labels,',
            '  uploaderText: (head.cells[head.cells.length - 1].textContent || "").trim(),',
            '  stickyShadow: sticky.length ? getComputedStyle(sticky[0]).boxShadow : null,',
            '  normalShadow: rows.length > 3 ? getComputedStyle(rows[3]).boxShadow : null,',
            '  barW: parseFloat(getComputedStyle(seedCell, "::after").width) || 0,',
            '  cellW: seedCell.getBoundingClientRect().width,',
            '  ratio: parseFloat(row.style.getPropertyValue("--hdui-ratio")) || 0',
            '};'
        ].join('\n'));
        assert(/repeating-linear-gradient/.test(frame.holeBefore),
            '左齿孔轨道是重复渐变, 实际: ' + String(frame.holeBefore).slice(0, 70));
        assert(/repeating-linear-gradient/.test(frame.holeAfter),
            '右齿孔轨道是重复渐变, 实际: ' + String(frame.holeAfter).slice(0, 70));
        // Chrome 对伪元素上的 counter() 只返回未求值的表达式, 拿不到 "01"/"02",
        // 所以这里只能验规则挂上了; 实际是否递增需看截图(骨架形态由 CSS 保证)
        assert(/counter\(frame/.test(frame.frameNo),
            '帧号由 counter(frame) 生成, 实际: ' + frame.frameNo);
        assertEq(frame.headPos, 'sticky', '片头(表头)吸顶, 长列表滚动后仍能排序');

        // 片头中文栏名: **只有图标没有文字的**列(评论/存活/大小/做种/下载/完成)才由 ::after 补栏名。
        // ⚠️ 必须**完全匹配**("评论" / "评论 ↓" / "评论 ↑"), 用 indexOf 子串会把"评论X"也放过。
        ['评论', '存活', '大小', '做种', '下载', '完成'].forEach(function (n) {
            const re = new RegExp('^"?' + n + '(?:\\s*[↓↑])?"?$');
            assert(frame.labels.some(function (l) { return re.test(l.trim()); }),
                '片头补出中文栏名「' + n + '」(实际: ' + JSON.stringify(frame.labels) + ')');
        });
        // 「发布者」列头真站**自带文字**(`<td class="colhead"><a>发布者</a></td>`), 所以 ::after
        // 只能补排序箭头 —— 再补一遍栏名就会渲染成「发布者 发布者 ↓」。
        assertEq(frame.uploaderText, '发布者', '发布者列头的文字来自站点本身');
        assert(frame.labels.every(function (l) { return l.indexOf('发布者') < 0; }),
            '发布者栏名不被重复补一遍(A4: 该格已有文字, ::after 只留箭头), 实际: '
            + JSON.stringify(frame.labels));

        // 置顶: 金色 inset 内阴影, 且不占流(普通行没有阴影)
        assert(/inset/.test(frame.stickyShadow || '') && /245, 179, 66/.test(frame.stickyShadow || ''),
            '置顶行有金色 inset 标记, 实际: ' + frame.stickyShadow);
        assert(frame.normalShadow === 'none' || !frame.normalShadow,
            '普通行没有阴影(置顶标记只给置顶行), 实际: ' + frame.normalShadow);

        // 占比条宽度 = --hdui-ratio × 格宽(误差 <=2px, 可能是取整)
        const want = frame.ratio * frame.cellW;
        assert(Math.abs(frame.barW - want) <= 2,
            '占比条宽度 = ratio × 格宽: ' + frame.barW + ' ≈ ' + Math.round(want)
            + ' (ratio ' + frame.ratio + ', 格宽 ' + Math.round(frame.cellW) + ')');
        await page.close();

        // ---- 切回「原站默认」必须卸干净 ----
        sim.seed({ 'hdui.theme': 'default' });
        let p = await H.open(sim, 'hdhome-ui');
        await p.waitFor('return document.documentElement.dataset.hduiState === "off";', 10000, 'state=off');
        const clean = await p.eval([
            'const t = document.getElementById("torrenttable");',
            'const r = t.tBodies[0].rows[1];',
            'return {',
            '  css: !!document.getElementById("hdui-css"),',
            '  boot: !!document.getElementById("hdui-boot"),',
            '  alert: !!document.getElementById("hdui-alert"),',
            '  props: r.style.getPropertyValue("--hdui-cat") + "|" + r.style.getPropertyValue("--hdui-ratio"),',
            '  theme: document.documentElement.dataset.hduiTheme',
            '};'
        ].join('\n'));
        assertEq(clean.css, false, '回退后主题样式节点已移除');
        assertEq(clean.boot, false, '回退后底色补丁已移除');
        assertEq(clean.alert, false, '回退后不弹横幅(是主动选择, 不是错误)');
        assertEq(clean.props, '|', '回退后行上的自定义属性已清理');
        assertEq(clean.theme, 'default', '回退后状态标记为 default');
        await p.close();

        // ---- 记忆: 记住上次选择 ----
        sim.seed({ 'hdui.theme': 'film' });
        p = await H.open(sim, 'hdhome-ui');
        await H.waitState(p, 'applied');
        assertEq(await H.themeOf(p), 'film', '重新打开记住上次选择: film');

        // ---- 面板: 真实鼠标点击可切换 ----
        await H.clickDock(p);
        const top = await H.panelTop(p);
        assert(top !== null, '点内嵌开关后面板展开(hit-test 命中 shadow 宿主)');
        const changed = await H.clickFirstPanelItemThatChanges(p);
        assert(changed !== null && changed !== 'film', '点面板条目可切回原站默认: film -> ' + changed);
        assert(ALL_IDS.indexOf(changed) >= 0, '切换结果是合法主题 id: ' + changed);

        // ---- 快捷键循环切换 ----
        const before = await H.themeOf(p);
        await H.pressAltShiftT(p);
        const after = await H.themeOf(p);
        assert(after !== before, 'Alt+Shift+T 循环切换生效: ' + before + ' -> ' + after);
        await p.close();

        // ---- 记忆落盘并重放 ----
        p = await H.open(sim, 'hdhome-ui');
        await H.waitState(p, 'applied');
        assertEq(await H.themeOf(p), after, '再次打开页面仍记得 ' + after);
        assertEq(sim.get('hdui.theme'), after, 'GM 存储写入正确');
        await p.close();
    }, { scriptPath: H.HDUI_PATH });
});
