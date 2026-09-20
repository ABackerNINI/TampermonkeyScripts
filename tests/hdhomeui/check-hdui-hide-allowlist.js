#!/usr/bin/env node
'use strict';
/**
 * 静态校验: 「隐藏类声明」白名单(deny-by-default)
 * ------------------------------------------------------------------
 * 为什么单独一个用例:
 *   本主题是**纯 CSS 层**, 而 "对未知元素不默认屏蔽" 是它的安全底线。
 *   但"屏蔽"不止 `display:none` 一种写法 —— visibility / opacity / clip-path / content-visibility /
 *   text-indent:-9999 / font-size:0 都是同一件事, 而且**写的时候毫无心理负担**:
 *   "这个元素挡着了, 先 display:none 吧" —— 一次这样, 下次就会对未知的公告 / 弹窗 / 新标签如法炮制。
 *
 *   既有测试全是**正向断言**(骨架特征存在 / 已知元素画得对), 缺的正是这道反向闸门。
 *
 * 做法: 扫源码里所有隐藏类声明, 逐条与白名单比对 ——
 *   · 白名单外的隐藏声明 => FAIL(并把原文打印出来定位)
 *   · 白名单里的条目若已消失 => FAIL(防白名单变成无人维护的僵尸清单)
 *   · 隐藏声明不得带 !important(会锁死站点与用户的覆盖)
 *   · 隐藏声明的选择器不得是裸元素 / 通配(table{display:none} 级别的事故就靠这条拦)
 *   · 每条隐藏声明的紧邻上下文必须有 `//` 理由注释(防"先加规则后补理由")
 *   · contain / overflow / z-index / position:fixed 一并白名单化(它们是"看不见"的另外几条通道)
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'HDHomeUI.user.js');
const src = fs.readFileSync(SRC, 'utf8');

/**
 * 去掉注释再扫 —— 源码里大量注释在**举例说明**这些写法(例如 `// 平时 visibility:hidden`),
 * 不剥掉会把注释当成声明, 白名单永远对不上。
 * ⚠️ `//` 前是 `:` 的不剥(字符串里的 `http://` 是内容, 不是注释)。
 */
function stripComments(s) {
    return s
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const code = stripComments(src);

let failed = 0;
function ok(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); } else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n' + t); }

/** 收集所有匹配位置 */
function at(re) {
    const out = [];
    const r = new RegExp(re.source, 'g');
    let m;
    while ((m = r.exec(code))) out.push(m.index);
    return out;
}
/** 某个位置周围的代码片段(用于白名单认领 / 报错定位) */
function ctx(i, before, after) {
    return code.slice(Math.max(0, i - (before || 120)), i + (after || 40)).replace(/\s+/g, ' ');
}
/**
 * 该声明所属的**那一条规则**(从上一个分隔符起到声明结束)。
 * ⚠️ 认领必须基于"这条规则的选择器", 不能基于"前后 N 个字符" —— 后者会把相邻那条规则的
 *    选择器也算进窗口, 于是新加的隐藏规则能被隔壁的条目认领走(反向验证时抓到过)。
 */
function selOf(i) {
    let brace = -1;
    for (let k = i - 1; k >= Math.max(0, i - 400); k--) {
        if (code[k] === '{') { brace = k; break; }
    }
    if (brace < 0) return ctx(i, 80, 30);
    let start = 0;
    for (let k = brace - 1; k >= Math.max(0, brace - 400); k--) {
        const c = code[k];
        if (c === ';' || c === '}' || c === '{') { start = k + 1; break; }
        // ⚠️ 逗号只在**行尾**才算语句分隔: `tdSel(m, 'size')` 里的逗号是参数分隔,
        //    当成边界会把选择器截成 `'size') + ' br{...}`(反向验证时抓到过)。
        if (c === ',') {
            let j = k + 1;
            while (j < code.length && (code[j] === ' ' || code[j] === '\t')) j++;
            if (code[j] === '\n') { start = k + 1; break; }
        }
    }
    return code.slice(start, i + 30).replace(/\s+/g, ' ').trim();
}
/**
 * 该声明是不是写在**属性选择器**里面 —— `:not([style*="display: none"])` 这种是"匹配折叠态",
 * 不是"把东西藏起来", 不能算隐藏声明。
 */
function insideBracket(i) {
    let depth = 0;
    for (let k = i - 1; k >= Math.max(0, i - 80); k--) {
        const c = code[k];
        if (c === ']') depth++;
        else if (c === '[') { if (depth === 0) return true; depth--; }
    }
    return false;
}

/**
 * 该声明的紧邻上下文里有没有 `//` 理由注释(前 6 行内)。
 * ⚠️ 锚点必须**止于声明本身**: 往后再取字符会撞上被剥掉的注释, 在原文里就找不到了。
 */
function hasReason(i) {
    const anchor = code.slice(Math.max(0, i - 24), i + 14);
    const p = src.indexOf(anchor);
    if (p < 0) return false;
    const lines = src.slice(0, p).split('\n');
    for (let k = lines.length - 1, n = 0; k >= 0 && n < 6; k--, n++) {
        if (/\/\//.test(lines[k])) return true;
    }
    return false;
}

// ==================================================================
section('1. 隐藏类声明白名单(白名单外一律 FAIL)');
// ==================================================================

/** 真正的隐藏声明(不含注释里的举例) */
const HIDE_RE = /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|content-visibility\s*:\s*hidden|clip-path\s*:|text-indent\s*:\s*-|font-size\s*:\s*0(?![.\d])/g;

/**
 * 白名单: 每条 = { why: 理由, claim: 认领正则(匹配声明周围的代码片段) }
 * ⚠️ 新增任何一条隐藏声明, 都必须**同时**在这里补一行并写清理由 —— 否则 CI 红。
 */
const HIDE_ALLOW = [
    {
        why: '大小列的 <br>: 站点用 <br> 把"8.15GB"和"-"拆两行, 主题竖排后它是多余的行距',
        claim: /tdSel\(m, 'size'\) \+ ' br\{display:none/
    },
    {
        why: '动作区的 <br>: 豆瓣/IMDb、下载/收藏已改 flex 竖排, <br> 只会多撑出行距',
        claim: /TN_META \+ ' br\{display:none/
    },
    {
        why: '搜索箱折叠小图标: 站点用图片 + 文字链接做折叠开关, 主题改用 CSS caret 代替',
        claim: /table\.searchbox img\.plus\{display:none/
    },
    {
        why: '自持面板的关闭态(不是站内元素): 展开时才 display:grid',
        claim: /\.panel\{position:fixed;display:none/
    }
];

const hideHits = [];
{
    let m;
    while ((m = HIDE_RE.exec(code))) {
        if (!insideBracket(m.index)) hideHits.push(m.index);
    }
}

const used = new Array(HIDE_ALLOW.length).fill(0);
const unclaimed = [];
hideHits.forEach(function (i) {
    const c = selOf(i);
    let hit = -1;
    for (let k = 0; k < HIDE_ALLOW.length; k++) {
        if (HIDE_ALLOW[k].claim.test(c)) { hit = k; break; }
    }
    if (hit < 0) unclaimed.push(c); else used[hit]++;
});

ok(unclaimed.length === 0,
    '没有白名单外的隐藏声明(共 ' + hideHits.length + ' 条声明, 白名单 ' + HIDE_ALLOW.length + ' 条)'
    + (unclaimed.length ? '; 未认领: ' + JSON.stringify(unclaimed.slice(0, 5)) : ''));

HIDE_ALLOW.forEach(function (a, k) {
    ok(used[k] >= 1, '白名单条目仍有效: ' + a.why);
});

// ==================================================================
section('2. 隐藏的写法也受限');
// ==================================================================

ok(!/display\s*:\s*none\s*!important/.test(code),
    '没有任何 display:none !important(!important 会锁死站点与用户对它的覆盖)');
ok(!/visibility\s*:\s*hidden/.test(code),
    '不使用 visibility:hidden(它保留占位却看不见, 比 display:none 更难排查)');
ok(!/opacity\s*:\s*0(?![.\d])/.test(code),
    '不使用 opacity:0(同上: 元素还在、还在参与 hit-test, 却看不见)');
ok(!/clip-path\s*:/.test(code), '不使用 clip-path 裁切');
ok(!/content-visibility\s*:\s*hidden/.test(code), '不使用 content-visibility:hidden');
ok(!/text-indent\s*:\s*-/.test(code), '不使用 text-indent 负值把文字推出可视区');
ok(!/font-size\s*:\s*0(?![.\d])/.test(code), '不使用 font-size:0 让文字消失');

// 裸元素 / 通配 —— table{display:none} 级别的事故就靠这条拦
const BARE_RE = /(^|[;}'"])\s*(div|span|td|tr|table|ul|li|body|html|p|img|a|font|\*)\s*\{\s*display\s*:\s*none/;
ok(!BARE_RE.test(code),
    '没有"裸元素 / 通配 + display:none"(隐藏必须挂在一个够具体的祖先下面)');

// 每条隐藏声明都要有理由注释
const noReason = hideHits.filter(function (i) { return !hasReason(i); });
ok(noReason.length === 0,
    '每条隐藏声明都有 // 理由注释'
    + (noReason.length ? '; 缺理由: ' + JSON.stringify(noReason.map(function (i) { return ctx(i, 60, 30); })) : ''));

// ==================================================================
section('3. contain: 只允许 inline-size(不得裁切、不得改定位基准)');
// ==================================================================
const containHits = at(/contain\s*:/);
const containVals = containHits.map(function (i) {
    return (code.slice(i, i + 40).match(/contain\s*:\s*([^;}]+)/) || [, '?'])[1].trim();
});
const badContain = containVals.filter(function (v) { return v !== 'inline-size'; });
ok(containHits.length > 0 && badContain.length === 0,
    'contain 的取值只有 inline-size(共 ' + containHits.length + ' 处: ' + containVals.join(', ') + ')'
    + (badContain.length ? '; 非法值: ' + JSON.stringify(badContain) : ''));
// paint / strict / content / size 会裁切溢出内容, 或让该元素变成 fixed 后代的定位基准 —— 两者都等于"屏蔽未知元素"
ok(badContain.length === 0,
    '不含 contain:paint / strict / content / size(它们会裁切溢出内容或改变定位基准)');

// ==================================================================
section('4. overflow:hidden 白名单(它会裁掉格子里新出现的东西)');
// ==================================================================
const OVER_ALLOW = [
    { why: '片头格子: 列宽固定, 长的栏名要裁', claim: /H \+ ' > td\{[^}]*overflow:hidden/ },
    { why: '数据行格子: 同上, 防止长内容把 flex 列撑开', claim: /R \+ ' > td\{overflow:hidden/ },
    { why: '标题链接: 省略号必需', claim: /TN_TITLE \+ ' > a\{[^}]*overflow:hidden/ },
    { why: '发布者列: 省略号必需', claim: /uploader'\) \+ '\{[^}]*overflow:hidden/ },
    { why: '搜索箱卡片: 圆角裁切', claim: /border-radius:12px;padding:0;overflow:hidden/ },
    { why: '自持入口胶囊', claim: /user-select:none;overflow:hidden/ },
    { why: '自持入口的文字区: 省略号', claim: /\.dock \.name\{overflow:hidden/ }
];
const overHits = at(/overflow\s*:\s*hidden/);
const overUsed = new Array(OVER_ALLOW.length).fill(0);
const overUn = [];
overHits.forEach(function (i) {
    const c = selOf(i);
    let hit = -1;
    for (let k = 0; k < OVER_ALLOW.length; k++) { if (OVER_ALLOW[k].claim.test(c)) { hit = k; break; } }
    if (hit < 0) overUn.push(c); else overUsed[hit]++;
});
ok(overUn.length === 0,
    '没有白名单外的 overflow:hidden(共 ' + overHits.length + ' 处)'
    + (overUn.length ? '; 未认领: ' + JSON.stringify(overUn.slice(0, 4)) : ''));
OVER_ALLOW.forEach(function (a, k) { ok(overUsed[k] >= 1, 'overflow 白名单条目仍有效: ' + a.why); });

// ==================================================================
section('5. z-index / position:fixed 只留给自持 UI(不得压住站内浮层)');
// ==================================================================
const SELF_UI = /#hdui|hdui-root|\.panel|\.dock|alert|--ui-|HOST_BASE|data-hdui/;
// 自持 UI 的代码区(HOST_BASE 之后全是开关/面板/胶囊的样式) —— 这段里的 z-index 一律放行。
// ⚠️ 不能只靠"上下文里有没有关键词": 面板样式块很长, 关键词常常落在窗口外面。
const SELF_FROM = code.indexOf('const HOST_BASE');
function inSelfUi(i) {
    return (SELF_FROM >= 0 && i >= SELF_FROM) || SELF_UI.test(ctx(i, 160, 20));
}
const zHits = at(/z-index\s*:/);
const badZ = zHits.filter(function (i) {
    const tail = code.slice(i, i + 24);
    const v = parseInt((/z-index\s*:\s*(-?\d+)/.exec(tail) || [0, '0'])[1], 10);
    if (v <= 6) return false;     // 片头吸顶那档, 站内浮层通常都更高
    return !inSelfUi(i);          // 大 z-index 只准出现在自持 UI 上
});
ok(badZ.length === 0,
    '站内样式里没有大 z-index(共 ' + zHits.length + ' 处)'
    + (badZ.length ? '; 越界: ' + JSON.stringify(badZ.map(function (i) { return ctx(i, 90, 30); })) : ''));

const fixHits = at(/position\s*:\s*fixed/);
const badFix = fixHits.filter(function (i) { return !inSelfUi(i); });
ok(badFix.length === 0,
    '主题 CSS 里没有 position:fixed(共 ' + fixHits.length + ' 处, 全部属于自持 UI)'
    + (badFix.length ? '; 越界: ' + JSON.stringify(badFix.map(function (i) { return ctx(i, 90, 30); })) : ''));

console.log('');
if (failed) {
    console.error('FAIL check-hdui-hide-allowlist: ' + failed + ' 项不达标');
    process.exit(1);
}
console.log('PASS check-hdui-hide-allowlist: 隐藏类声明全部在白名单内');
process.exit(0);
