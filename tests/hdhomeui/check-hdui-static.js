#!/usr/bin/env node
'use strict';
/**
 * 静态校验: src/HDHomeUI.user.js
 * ------------------------------------------------------------------
 * 零依赖、无需浏览器。钉死四件事:
 *   1. 元数据完整性与最小权限面(只申请 GM_getValue / GM_setValue)
 *   2. 危险 API 禁令(不点击、不派发事件、不提交表单、不发网络请求、不 innerHTML)
 *   3. 不静默吞错(无空 catch)、不留测试后门(无 window.__ 钩子)
 *   4. 5 套主题齐备且结构声明互不相同(不是只换颜色)
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src', 'HDHomeUI.user.js');
const src = fs.readFileSync(SRC, 'utf8');

let failed = 0;
function ok(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); } else { failed++; console.log('  ✗ ' + msg); }
}
function section(t) { console.log('\n' + t); }

// ---------- 1. 元数据 ----------
section('1. UserScript 元数据');
const meta = function (k) {
    const re = new RegExp('^//\\s*@' + k + '\\s+(.*)$', 'm');
    const m = re.exec(src);
    return m ? m[1].trim() : null;
};
for (const k of ['name', 'namespace', 'version', 'description', 'author', 'license', 'match', 'run-at']) {
    ok(!!meta(k), '@' + k + ' 存在: ' + (meta(k) || '(缺失)'));
}
ok(/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(meta('version') || ''), '@version 符合 YYYY.MM.DD.N: ' + meta('version'));
ok(!!meta('name:zh-CN'), '@name:zh-CN 存在: ' + (meta('name:zh-CN') || '(缺失)'));
ok((meta('match') || '').indexOf('hdhome.org') >= 0, '@match 限定 hdhome.org: ' + meta('match'));

const grants = (src.match(/^\/\/\s*@grant\s+(\S+)$/gm) || []).map(function (s) { return s.replace(/^\/\/\s*@grant\s+/, ''); });
ok(grants.length === 2 && grants.indexOf('GM_getValue') >= 0 && grants.indexOf('GM_setValue') >= 0,
    '权限面最小(仅 GM_getValue/GM_setValue): ' + JSON.stringify(grants));

// ---------- 2. 危险 API 禁令 ----------
section('2. 危险操作静态禁令(不得误触站内动作)');
const FORBIDDEN = [
    [/\.\s*click\s*\(\s*\)/, '不得调用 .click() 触发站内元素'],
    [/dispatchEvent/, '不得派发合成事件'],
    [/\.\s*submit\s*\(\s*\)/, '不得调用 .submit() 提交站内表单'],
    [/\brequestSubmit\b/, '不得调用 requestSubmit()'],
    [/\beval\s*\(/, '不得使用 eval'],
    [/new\s+Function/, '不得使用 new Function'],
    [/innerHTML/, '不得使用 innerHTML 注入页面内容'],
    [/outerHTML/, '不得使用 outerHTML'],
    [/\bdocument\.write\b/, '不得使用 document.write'],
    [/\bcloneNode\b/, '不得克隆站内节点进自持 UI'],
    [/\bfetch\s*\(/, '不得发起 fetch 请求'],
    [/XMLHttpRequest/, '不得发起 XHR 请求'],
    [/GM_xmlhttpRequest/, '不得申请/使用 GM_xmlhttpRequest'],
    [/\bsetAttribute\(\s*['"]href['"]/, '不得改写站内元素 href'],
    [/\bsetAttribute\(\s*['"]onclick['"]/, '不得给站内元素挂 onclick']
];
for (const pair of FORBIDDEN) {
    ok(!pair[0].test(src), pair[1]);
}

// ---------- 3. 不静默吞错 / 不留后门 ----------
section('3. 错误处理与可测性纪律');
ok(!/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/.test(src), '无空 catch(异常必须落到 Diag)');
ok(!/catch\s*\{\s*\}/.test(src), '无省略参数的空 catch');
ok(!/window\.__/.test(src), '不留 window.__ 测试钩子(conventions §8.2)');
ok(/addEventListener\(\s*['"]error['"]/.test(src), '挂载 window error 兜底');
ok(/addEventListener\(\s*['"]unhandledrejection['"]/.test(src), '挂载 unhandledrejection 兜底');
ok(/Diag\.fail\(/.test(src), 'catch 统一走 Diag.fail');
ok(/showAlert\(/.test(src), '结构错误有可见横幅提醒');
ok(/fallbackToDefault\(/.test(src), '结构错误会回退默认 UI');
ok(/GM_setValue/.test(src) && /hdui\.theme/.test(src), '主题选择写入持久化存储');

// ---------- 4. 主题定义与胶片墙骨架特征 ----------
section('4. 主题定义与胶片墙骨架特征(不是只换颜色)');
const THEME_IDS = ['film'];
const THEME_NAMES = ['胶片墙'];
for (let i = 0; i < THEME_IDS.length; i++) {
    const id = THEME_IDS[i];
    ok(new RegExp("id: '" + id + "'").test(src), '主题 ' + id + ' 已定义');
    ok(src.indexOf(THEME_NAMES[i]) >= 0, '主题中文名: ' + THEME_NAMES[i]);
}
ok(/DEFAULT_ID\s*=\s*'default'/.test(src) && /id:\s*DEFAULT_ID/.test(src), '提供「原站默认」可切回');

// 旧 5 套已废弃 —— 名字与函数都不该再有残留(防留死代码)
['片库索引', '电传纸带', '大开本', '瑞士网格', '播控台'].forEach(function (n) {
    ok(src.indexOf(n) < 0, '旧主题已彻底移除: ' + n);
});
['reelCss', 'tapeCss', 'sheetCss', 'swissCss', 'signalCss',
    'statStack', 'statInline', 'headStrip'].forEach(function (f) {
    ok(src.indexOf(f) < 0, '旧主题/工具函数无残留: ' + f);
});

// 胶片墙的骨架特征 —— 逐条钉死, 少一条就不叫胶片墙
const filmBlock = (src.match(/function filmCss\(m[,)]/) || [])[0] || '';
ok(filmBlock.length > 0, '取到 filmCss 实现体');
ok(/> tbody\{display:flex;flex-direction:column/.test(src), '片基: tbody 是纵向 flex(一帧一行依次排布)');
ok(/tbody::before[\s\S]{0,240}?repeating-linear-gradient/.test(src)
    && /tbody::after[\s\S]{0,240}?repeating-linear-gradient/.test(src),
    '左右两条齿孔轨道(repeating-linear-gradient)');
ok(/counter-reset:frame/.test(src) && /counter-increment:frame/.test(src)
    && /counter\(frame,decimal-leading-zero\)/.test(src),
    '帧号由 counter 打在片边上(纯 CSS, 不写 DOM)');
ok(/position:sticky;top:0/.test(src), '片头(表头)吸顶, 长列表也能排序');
ok(/calc\(var\(--hdui-ratio,0\) \* 100%\)/.test(src), '做种列内嵌占比条(吃 --hdui-ratio)');
ok(/\.sticky_top\{box-shadow:inset/.test(src), '置顶标记用 inset 阴影(不占流, 不把列推开)');
ok(!/navIcons:\s*false/.test(src), '胶片墙挂导航图标(当前无主题禁用)');

// 同一套主题里的三族字体也必须分工明确(正文 / 标题 / 数字)
const filmVars = (src.match(/id: 'film'[\s\S]*?css: filmCss/) || [])[0] || '';
const fonts = new Set((filmVars.match(/--hdui-font(-title|-num)?':\s*'([^']+)'/g) || [])
    .map(function (s) { return /(?:num|title)?':\s*'([^']+)'/.exec(s)[1]; }));
ok(fonts.size >= 3, '胶片墙三族字体分工明确(正文/标题/数字), 实际 ' + fonts.size + ' 种');

// ---------- 5. 结构契约定义 ----------
section('5. 结构契约(改版检测抓手)');
const colBlock = /const COLUMNS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(src);
const cols = colBlock ? (colBlock[1].match(/'(\w+)'/g) || []) : [];
ok(cols.length === 12, '种子表列字典 12 列: ' + cols.length);
for (const need of ['title', 'seeders', 'leechers', 'size', 'uploader', 'type']) {
    ok(cols.indexOf("'" + need + "'") >= 0, '列字典含 ' + need);
}
ok(src.indexOf('#nav_block') >= 0 && src.indexOf('#info_block') >= 0 && src.indexOf('table.mainouter') >= 0,
    'A 级锚点齐全(主框架 / 导航 / 信息栏)');
ok(/E_ANCHOR_MISSING/.test(src) && /E_COLUMN_UNKNOWN/.test(src) && /ROW_CELL_COUNT_MISMATCH/.test(src),
    '错误码齐备(锚点缺失 / 列不可识别 / 行列数不符)');
ok(/MutationObserver/.test(src), '运行时结构守卫(局部刷新后重新校验)');

// ---------- 6. 启动时机与默认行为 ----------
section('6. 启动时机与默认行为(不得擅自改界面)');
const uIdx = src.indexOf('function unload()');
const uBody = uIdx >= 0 ? src.slice(uIdx, src.indexOf('\n    }', uIdx)) : '';
ok(/stopWatch\(\)/.test(uBody), 'unload() 会停掉结构守卫(回退后 Observer 不空转)');
// 首装直接上妆胶片墙(装这个脚本就是为了用它); 「原站默认」仍能在面板里选
ok(/const FIRST_ID\s*=\s*'film'/.test(src), '首次安装默认上妆胶片墙(FIRST_ID=film)');
ok(!/storeGet\(STORE_THEME,\s*DEFAULT_ID\)/.test(src),
    '读取当前主题不再用 DEFAULT_ID 兜底(否则首装被读成"不上妆", 与 FIRST_ID 自相矛盾)');
const pi = src.lastIndexOf('paintBootBgWhenPossible();');
const ri = src.indexOf("if (document.readyState === 'loading')");
ok(/@run-at\s+document-start/.test(src), '@run-at document-start 已声明');
ok(pi > 0 && ri > pi, '铺底色在 readyState 分支之前(真正的 document-start)');
ok(/E_BOOT_PAINT/.test(src), '铺底色异常有独立错误码');
ok(/function paintBootBgWhenPossible/.test(src) && /bootObserver\.observe\(document/.test(src),
    '连 <html> 都还没建时退化为「一出现就铺」, 不依赖 DOMContentLoaded');

// ---------- 7. 入口内嵌(2026.09.19.3: 不再用右下角浮动按钮) ----------
section('7. 入口内嵌: 不占悬浮位、不压站内内容');
ok(/DOCK_MODE\s*=\s*'inline'/.test(src), '入口模式声明为 inline(内嵌)');
ok(/const HOST_BASE[\s\S]{0,240}?position:absolute/.test(src), '宿主用 absolute 定位(随页面滚动, 不悬浮)');
ok(!/\.fab\b/.test(src), '不再有浮动圆钮(.fab)样式');
ok(!/position:fixed;right:18px;bottom:18px/.test(src), '不再占用右下角 18px 悬浮位');
ok(/function dockRect/.test(src) && /ul#mainmenu/.test(src), '入口位置由导航栏末尾空档量出');
ok(/position\s*=\s*'fixed'/.test(src) && /function dockUi/.test(src),
    '导航栏取不到时才退化为 fixed(有兜底且写在 dockUi 里)');
ok(!/uiRoot\.style\.cssText\s*=\s*HOST_BASE/.test(src.replace(/cssText = HOST_BASE;\s*$/m, ''))
    || /不用 cssText 整体重写/.test(src),
    '重摆入口不整体重写 cssText(否则会清掉宿主上的 --ui-* 配色变量)');

// ---------- 8. 版式不再"堆成一坨" ----------
section('8. 版式: 指标成块 / 导航有间距');
ok(/function tdRule/.test(src) && /filter\(function \(k\) \{ return !!m\[k\]; \}\)/.test(src),
    '数值成列排布且对缺列免疫(不再 12 个格子挤一行)');
ok(/ul#mainmenu\{display:flex;flex-wrap:wrap/.test(src), '导航用 flex + wrap(不再 inline-block 紧挨)');
ok(/--hdui-navgap/.test(src) && /column-gap:var\(--hdui-navgap\)/.test(src), '导航有显式列间距变量');
ok(/--hdui-navitem/.test(src), '导航条目内边距可配(--hdui-navitem)');
ok(/const FILM_W/.test(src) && /basis\.push\(H \+ /.test(src) && /basis\.push\(R \+ /.test(src),
    '表头与数据行共用同一套列宽(数值才能成列对齐, 不飘)');

// ---------- 9. 可选列 + 等待窗口(2026.09.19.4: A / A·GB 是别的脚本注入的) ----------
section('9. 可选列: A / A·GB 缺席或晚到都不能误判为结构损坏');
ok(/const OPTIONAL_COLUMNS[\s\S]{0,120}?'a',\s*'ave'/.test(src),
    'A / A·GB 声明为可选列(不是硬性契约)');
ok(/const REQUIRED_COLUMNS[\s\S]{0,160}?OPTIONAL_COLUMNS\.indexOf/.test(src),
    '必需列由全集剔除可选列得出(不两处各写一遍, 免得漂移)');
ok(/absent: absent/.test(src) && /OPTIONAL_COLUMNS\[i\]\]\s*===\s*undefined/.test(src),
    'detectColumns 单独统计"缺席的可选列"');
ok(/code: 'OK_NO_CALC'/.test(src), '缺可选列时返回 OK_NO_CALC(成功码, 不是错误码)');
ok(/function tdSel\(m, k\) \{\s*return m\[k\] \?/.test(src) && /s\.length \? s\.join/.test(src),
    '排版函数在列缺席时跳过该列(不生成指向空槽位的 nth-child)');
ok(/绝不能生成 :nth-child\(undefined\)/.test(src), '注释里写明了这条约束的来由');
ok(/const STRUCT_CODES[\s\S]{0,200}?ROW_CELL_COUNT_MISMATCH/.test(src),
    '结构类错误码单列一份(用于判定要不要等窗口)');
ok(/function armPending/.test(src) && /function tickPending/.test(src) && /function stopPending/.test(src),
    '有「等结构就绪」窗口: armPending / tickPending / stopPending');
ok(/dataset\.hduiState = 'pending'/.test(src), '等待窗口有可观测状态(pending, 便于排查时序)');
ok(/STRUCT_CODES\.indexOf\(v\.code\)\s*>=\s*0/.test(src),
    '首装与运行中变化两条路径都走等待窗口, 不直接弹横幅');
ok(/E_STRUCT_TIMEOUT/.test(src), '窗口超时才真正回退并弹横幅(不再一上来就报错)');
ok(/sig !== appliedSig/.test(src) && /function colMapSig/.test(src),
    '列集合变化(外部脚本补列)会重摆一次, 让 nth-child 重新对齐');

// ---------- 10. 图标体系 ----------
// 高危点: iconUri() 里名字写错会**静默退化**成 ICONS.other(图形错但页面不报错),
// 肉眼看只是一两个图标画错, 极难发现 —— 所以必须在这里静态比对一遍。
section('10. 图标体系: 引用的名字都存在 / SVG 有固有尺寸 / 图标层不压主题');

// 抽出 ICONS 的键名
const iconsBlock = (src.match(/const ICONS = Object\.freeze\(\{([\s\S]*?)\n    \}\);/) || [])[1] || '';
const iconKeys = (iconsBlock.match(/^\s{8}(\w+):/gm) || []).map(function (s) { return s.trim().replace(':', ''); });
ok(iconKeys.length >= 25, 'ICONS 至少 25 个图形(实际 ' + iconKeys.length + ')');

// ICON_CAT / ICON_MET / ICON_NAV 里引用的名字必须都在 ICONS 里(下面逐表精确核对)
let refBad = [];

// 逐个核对: ICON_CAT 的图标名 / ICON_MET 的图标名 / ICON_NAV 的图标名
const catBlock = (src.match(/const ICON_CAT = Object\.freeze\(\[([\s\S]*?)\n    \]\);/) || [])[1] || '';
const metBlock = (src.match(/const ICON_MET = Object\.freeze\(\{([\s\S]*?)\n    \}\);/) || [])[1] || '';
const navBlock = (src.match(/const ICON_NAV = Object\.freeze\(\[([\s\S]*?)\n    \]\);/) || [])[1] || '';

const catNames = (catBlock.match(/,\s*'(\w+)'\s*,/g) || []).map(function (s) { return s.replace(/[,\s']/g, ''); });
const metNames = (metBlock.match(/\[\s*'(\w+)'\s*,/g) || []).map(function (s) { return s.replace(/[\[\s']/g, '').replace(',', ''); });
const navNames = (navBlock.match(/,\s*'(\w+)'\s*,/g) || []).map(function (s) { return s.replace(/[,\s']/g, ''); });

for (const n of catNames) {
    if (iconKeys.indexOf(n) < 0) refBad.push('ICON_CAT -> ' + n);
}
for (const n of metNames) {
    if (iconKeys.indexOf(n) < 0) refBad.push('ICON_MET -> ' + n);
}
for (const n of navNames) {
    if (iconKeys.indexOf(n) < 0) refBad.push('ICON_NAV -> ' + n);
}
ok(catNames.length >= 7, 'ICON_CAT 覆盖 7 类类别图标(实际 ' + catNames.length + ')');
ok(metNames.length >= 8, 'ICON_MET 覆盖 8 个指标图标(实际 ' + metNames.length + ')');
ok(navNames.length >= 16, 'ICON_NAV 覆盖 16 个导航图标(实际 ' + navNames.length + ')');
ok(refBad.length === 0, '所有引用的图标名都在 ICONS 里(防静默退化成 other): '
    + (refBad.length ? refBad.join(', ') : '全部命中'));

// P42: SVG 必须带 width/height, 否则 img{content:url()} 替换后固有尺寸为 0
ok(/viewBox="0 0 24 24" width="16" height="16"/.test(src),
    'iconUri 生成的 SVG 带 width/height(P42: 否则 img 固有尺寸 0, 压塌外层 <a>)');

// 图标层只写 content, 不写死尺寸 —— 让主题用更高特异性自己定
const iconCssBlock = (src.match(/function iconCss\(\) \{([\s\S]*?)\n    \}/) || [])[1] || '';
ok(!/width:\s*\d+px/.test(iconCssBlock), 'iconCss 不写死 width(主题用自己的规则覆盖)');
ok(!/height:\s*\d+px/.test(iconCssBlock), 'iconCss 不写死 height(主题用自己的规则覆盖)');

// ---- 「图标未成功替换」的真因防回退 ----
// 真站 `catsprites.css` 是 `img[class*="c_"]{background-image:url(catsprites.png) !important}`。
// 带 !important 的背景图**压不过普通声明**, 而 `background:rgba(...)` 简写里的
// background-image:none 正是普通声明 ⇒ 雪碧图照旧透在换上去的 SVG 底下(45×46 裁 22px = 碎片)。
ok(/background-image:\s*none\s*!important/.test(iconCssBlock),
    '类别图标显式把 background-image 清成 none !important(站点那条雪碧图带 !important)');
ok(!/background:\s*rgba\(/.test(iconCssBlock),
    'iconCss 不用 `background:rgba()` 简写清底(它的 background-image:none 是普通声明, 压不过 !important)');

// ---- 标题格 4 个行内动作(真站独有, 原型 film.html 没有) ----
const actionBlock = (src.match(/const ICON_ACTION = Object\.freeze\(\[([\s\S]*?)\]\);/) || [])[1] || '';
ok(/icon-douban/.test(actionBlock) && /icon-imdb/.test(actionBlock)
    && /img\.download/.test(actionBlock) && /img\.delbookmark/.test(actionBlock),
    'ICON_ACTION 覆盖真站标题格 4 个动作(豆瓣/IMDb 按 src 选 —— 它们没有 class)');
ok(/ICON_ACTION\.forEach/.test(iconCssBlock), 'iconCss 生成这 4 个动作的替换规则');
ok(/background-image:'\s*\+\s*u\s*\+\s*'\s*!important/.test(iconCssBlock),
    '动作图标 content 与 background-image 双写同一张(站点用 background 画, 只换 content 换不干净)');

// 零异步不变量: 本脚本没有 Promise/async/await/.then, 因此任何 UNHANDLED_REJECTION
// 都不可能由本脚本自己抛出 —— 这是把该告警判定为「来自页面或其它脚本」的前提。
// 一旦有人引入异步代码, 这条会失败, 提示同时去改 unhandledrejection 的措辞。
const asyncHits = (src.match(/\basync\s+function|\bawait\s|new\s+Promise\b|\.then\s*\(/g) || []);
ok(asyncHits.length === 0,
    '脚本零异步(无 Promise/async/await/.then)—— UNHANDLED_REJECTION 可判定为「来自外部」的前提'
    + (asyncHits.length ? '; 发现: ' + asyncHits.slice(0, 5).join(', ') : ''));

// 归因措辞: 光报 reason 会让人去 HDHomeUI 里找 innerText(其实在别的脚本里)
ok(/非 HDHomeUI 故障/.test(src),
    'unhandledrejection 日志明确标注「非 HDHomeUI 故障」(防归因误导)');
ok(/r\.stack/.test(src) || /\br\s*&&\s*r\.stack\b/.test(src),
    'unhandledrejection 日志带上 stack 首帧(便于定位真正的抛出方)');

// navIcons 开关机制仍在(主题可自行声明 navIcons:false), 只是当前没有主题用它
ok(src.indexOf('navIcons: false') < 0,
    '当前无主题禁用导航图标(旧 tape 的方括号设计语言已随该主题移除)');
ok(/theme\.navIcons !== false/.test(src), 'buildCss 依据 navIcons 开关决定是否挂导航图标');

// ---------- 11. 旧主题迁移(删主题不能让用户看到"结构坏了") ----------
section('11. 旧主题 id 迁移 / 配置类错误不冒充结构错误');
// 用户实测: 存储里还留着 tape, 删主题后报「页面结构与预期不符(E_UNKNOWN_THEME)」
ok(/const LEGACY_THEMES[\s\S]{0,160}?'reel',\s*'tape',\s*'sheet',\s*'swiss',\s*'signal'/.test(src),
    '旧 5 套 id 登记在 LEGACY_THEMES(删主题时必须同步登记, 否则老用户会报错)');
ok(/LEGACY_MIGRATE_TO\s*=\s*'film'/.test(src), '旧主题统一迁到胶片墙');
ok(/LEGACY_THEMES\.indexOf\(id\)\s*>=\s*0/.test(src) && /storeSet\(STORE_THEME, LEGACY_MIGRATE_TO\)/.test(src),
    '命中旧 id 时静默迁移并写回存储(不弹横幅 —— 用户没做错事)');
ok(/const CONFIG_CODES[\s\S]{0,80}?E_BAD_THEME/.test(src),
    '配置类错误码单列(E_BAD_THEME), 与结构类分开');
ok(src.indexOf('E_UNKNOWN_THEME') < 0, '废弃的 E_UNKNOWN_THEME 已不再使用');
// 措辞: 配置类说「主题设置无效」, 结构类才说「页面结构与预期不符」
ok(/主题设置无效/.test(src) && /CONFIG_CODES\.indexOf\(code\)/.test(src),
    'showAlert 按错误码分流措辞(配置类不说「页面结构与预期不符」)');
ok(/改用胶片墙/.test(src), '配置类横幅给「改用胶片墙」按钮(「重新尝试」对无效值没用)');

// ---------- 12. 原型保真度: 类别覆盖 / 促销 / 标签 / 列头去重 ----------
// 背景(pitfalls P48/P49): 原型是理想化页面, 真站的类名与结构并不一致 ——
// 照原型写的清单会漏掉真站真实存在的类别家族, 促销/标签的类名也会打空。
// 这几条把"必须覆盖真站清单"钉成静态不变量。
section('12. 原型保真度: 类别家族覆盖 / 促销是 img / 标签是 span.tags / 列头不重复');

// 真站实际出现过的类别家族前缀(统计自 resources-do-not-track 的脱敏整页, 12 族)
const REAL_CAT_PREFIXES = ['c_movies', 'c_movie', 'c_tvseries', 'c_tvshows', 'c_anime', 'c_cartoon',
    'c_doc', 'c_musics', 'c_tvmusics', 'c_sports', 'c_misc', 'c_4kuhd'];
const catPrefixes = (catBlock.match(/'c_[a-z0-9_]+'/g) || []).map(function (s) { return s.replace(/'/g, ''); });
const catMiss = REAL_CAT_PREFIXES.filter(function (p) {
    return !catPrefixes.some(function (q) { return q.indexOf(p) === 0; });
});
ok(catMiss.length === 0,
    'ICON_CAT 覆盖真站全部类别家族(缺一个就会显示雪碧图碎片), 缺: '
    + (catMiss.length ? catMiss.join(', ') : '无'));
ok(/img\[class\*="c_"\]/.test(src), '类别图标有兜底规则(img[class*="c_"])');

// 促销: 真站是 <img class="pro_*">, 不是 span.tags
ok(/const PRO_BADGES/.test(src) && /pro_50pctdown/.test(src) && /pro_free2up/.test(src),
    '促销徽章按真站的 img.pro_* 三个类名做');
// ⚠️ 只看**非注释**代码: 注释里会提到旧类名来说明来由, 那不是"还在用"
const srcCode = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(srcCode.indexOf('.tags.tfree') < 0,
    '不再使用 .tags.tfree(真站没有这个类名, 原型/仿真页才有 —— 见 P48)');
// 标签: 真站是 span.tags(带 23 种分类底色), 只改形状不改色
ok(/#torrenttable span\.tags\{/.test(src), '标签样式作用于真站的 span.tags');
ok(!/span\.tags\{[^}]*background:/.test(src),
    '标签只改形状, 不覆盖站点的分类底色(23 色保留)');

// 列头栏名去重: 必须有"该列头是否已有文字"的判定
ok(/headText/.test(src) && /headText\[k\]/.test(src),
    '列头栏名按 headText 分流(有文字的列只补箭头, 不再渲染成「发布者 发布者 ↓」)');
ok(/function colMapSig\(map, headText\)/.test(src),
    '列签名把 headText 也算进去(栏名会随表头文字变化, 变了要重摆)');

// 图标总数(含列头补充图标 + 促销徽章 + 面板图标)
ok(iconKeys.length >= 38, 'ICONS 至少 38 个图形(实际 ' + iconKeys.length + ')');
['hcat', 'htitle', 'hprog', 'hcalc', 'hratio', 'prodown', 'proFree', 'pro2up'].forEach(function (n) {
    ok(iconKeys.indexOf(n) >= 0, '列头/促销图标已定义: ' + n);
});
['douban', 'imdb', 'getdown', 'mark'].forEach(function (n) {
    ok(iconKeys.indexOf(n) >= 0, '标题格动作图标已定义: ' + n);
});

// ---------- 13. 全局底色: 站点通配浅色容器必须被压深 ----------
section('13. 全局底色(大面积白底的来源) / 动作区竖排');
// 站点 `table{background-color:#bccad6}` 是 (0,0,1) 通配 —— 原先只覆盖 .mainouter/.main,
// 种子表之外的任何表格(我的 / 论坛 / 搜索框)都在漏这块浅蓝灰。
// 用 indexOf 查固定子串 —— 这些 CSS 片段含 `[]{}()` 一堆元字符, 写正则转义容易出错且难读
ok(src.indexOf('html[data-hdui-theme]{background:var(--hdui-bg);}') >= 0,
    'html 也铺底色(只给 body 上色时, 短页面在 body 之下仍露出 <html> 的白)');
ok(src.indexOf('html[data-hdui-theme] table{background:var(--hdui-panel);}') >= 0,
    '通配 table 底色压成 panel(站点 table{background-color:#bccad6} 是大面积白底的来源)');
ok(src.indexOf('td.rowfollow,html[data-hdui-theme] td.colhead') >= 0,
    '表外近白格子(rowfollow #f4f4f9 / colhead #2f4879)一并压深');
ok(src.indexOf('[bgcolor]{background:var(--hdui-panel) !important;}') >= 0,
    '站点用 bgcolor 属性画的亮色块(顶部通知条等)被压深(属性选择器 + !important)');

// 动作区竖排: 旧写法把 <tr> 摊平成 flex 并去掉 <br>, 4 个链接全挤进同一条 inline 流
const filmBody = (src.match(/function filmCss\(m, headText\) \{([\s\S]*?)\n    \}/) || [])[1] || '';
ok(filmBody.length > 200, '取到 filmCss 完整实现体(第 4 节那条只取了函数签名)');
ok(/TN_META \+ ' td\{display:flex;flex-direction:column/.test(filmBody),
    '动作区两列各自竖排(评分列 / 操作列), 不再摊平成一条 inline 流');
ok(/TN_META \+ ' a\{display:inline-flex/.test(filmBody),
    '每个动作独立成 chip(圆角微底), 彼此不再粘连');

// .13 用户反馈: 四个动作按钮应跟在标题后面**同行**, 不是扔到第二行
// 旧版用 `flex:1 1 100%` 强制换行, 那是被用户否决的方案。
ok(/TN_META \+ '\{flex:0 0 auto/.test(filmBody),
    'meta(flex:0 0 auto)与标题**同行**, 不是 flex:1 1 100% 强制占满第二行(.13)');
ok(!/TN_META \+ '\{flex:1 1 100/.test(filmBody),
    'meta 不再用 flex:1 1 100%(把豆瓣/IMDb/下载/收藏挤到第二行, .13 用户否决的方案)');

// ---- .15 导航页签: 站点 ul.menu li a 自带 1px 白边 + #dedede 底, 只清 border 不清底就是白页签 ----
ok(/ul#mainmenu li a\{[^}]*background:transparent/.test(src),
    '导航项显式 background:transparent(.15: 站点 #dedede 浅灰底必须清掉, 否则首页/论坛等是一排白页签)');
ok(/ul#mainmenu li a\{[^}]*border:0/.test(src),
    '导航项清掉站点的 1px 白边');

// ---- .16 逻辑键 ≠ DOM class: 列映射把站点的 time 归到 alive, 但图标选择器要写 DOM 上真实的 class ----
ok(/alive:\s*\[\s*'clock'/.test(src) && /time:\s*\[\s*'clock'/.test(src),
    'ICON_MET 同时含 alive 与 time(.16: 真站列头是 img.time, 只写 img.alive 一条都不命中)');
['sticky', 'star', 'arrowup', 'arrowdown', 'inbox', 'sentbox', 'buddylist', 'rss', 'plus']
    .forEach(function (k) {
        ok(src.indexOf("['img." + k + "'") >= 0,
            'ICON_MISC 含站点自绘图标族 img.' + k + '(.16: 真站整页扫描发现的漏网族)');
    });

// ---- .17 站点 <font> 老式着色: 深色底上的深色字 = 看不见 ----
// ⚠️ 这些 CSS 是运行时由 INFO_COLORS 拼出来的, 源码里**没有**字面串 "font.color_ratio{color:#...}" ——
//    断言只能打在表上, 打在拼接结果上必然误报(刚踩过)。
['color_ratio', 'color_bonus', 'color_uploaded', 'color_downloaded',
    'color_invite', 'color_slots', 'color_active'].forEach(function (k) {
    ok(new RegExp("\\['" + k + "',\\s*'#[0-9a-f]{6}'\\]").test(src),
        'INFO_COLORS 含 ' + k + ' 且给了可读色位(.17: 站点原色 #1900d1 在深色底上看不见)');
});
ok(/INFO_COLORS\.map\(function \(x\) \{\s*return 'html\[data-hdui-theme\] font\.' \+ x\[0\] \+ '\{color:'/.test(src),
    '统计色是"一条一色"生成的(不是把 7 个选择器并成一条)');
ok(/const FONT_DARK_RED = Object\.freeze\(\[/.test(src) && /'#dd0000'/.test(src) && /'#550000'/.test(src),
    '暗红 font[color] 已枚举提亮(.17: #550000 与片基亮度差只有 3)');

// ---- .18 UA 渲染的界面: 滚动条 / 下拉弹层 / 自动填充 / 选中文字 ----
// 这些**不是 DOM 元素**, 漏白扫描与对比度扫描都看不见, 只能靠源码里有这几条来兜。
ok(/html\[data-hdui-theme\]\{color-scheme:dark;\}/.test(src),
    'color-scheme: dark(.18: 滚动条与 select 弹层是 UA 画的, 不设就永远是浅色)');
// ⚠️ 反断言: 不要自己写 ::-webkit-scrollbar 尺寸 —— 改滚动条宽度 = 改内容区宽度,
//    站点固定宽布局会跟着长(实测 1247 → 1252, 「不撑宽页面」直接红)。着色交给 color-scheme。
// ⚠️ 匹配必须带上 `'html[data-hdui-theme] ` 这个**规则前缀**: 只搜 `::-webkit-scrollbar{`
//    会被源码注释里"不要写 ::-webkit-scrollbar{width...}"这句话自己命中(刚踩过)。
ok(src.indexOf("'html[data-hdui-theme] ::-webkit-scrollbar") < 0,
    '不改滚动条几何(.18: 显式 width 会撑宽页面, 着色由 color-scheme 负责)');
ok(/input:-webkit-autofill/.test(src) && /-webkit-box-shadow:0 0 0 1000px/.test(src),
    '自动填充的浅黄底已用 inset box-shadow 盖掉(.18: autofill 改不了 background-color)');
ok(/::selection\{background:rgba\(245,179,66/.test(src),
    '选中文字用主题金(.18: 默认的高亮色在深色底上刺眼)');
ok(/::placeholder/.test(src),
    'placeholder 用了最弱一档灰(.18: 默认灰在深色底上过暗)');
ok(/input\[type=password\]/.test(src),
    'password / number / email 等输入框也深色化(.18: 原来只写了 type=text, 登录页会漏)');

// ---- .20 三种促销徽章必须分色(用户实拍「种子缺少Free标记」: 原来全是同一个金, 分不出哪个是免费) ----
ok(/\['pro_50pctdown', 'prodown', '#f5b342'\]/.test(src), '5折徽章=琥珀(#f5b342)');
ok(/\['pro_free', 'proFree', '#7fb84e'\]/.test(src), '免费徽章=绿(#7fb84e), 与 5折 分得开');
ok(/\['pro_free2up', 'pro2up', '#9b7fd4'\]/.test(src), '免费+双倍徽章=紫(#9b7fd4)');
// 反断言: 三种不能又是同一个色
// 逐条取(不用一条 alternation 正则: `free` 会先匹配到 `free2up` 的前缀再回溯, 容易漏)
const proColors = ['50pctdown', 'free', 'free2up'].map(function (k) {
    const m = new RegExp("\\['pro_" + k + "', '[a-zA-Z]+', '(#[0-9a-f]{6})'\\]").exec(src);
    return m ? m[1] : null;
});
ok(proColors.length >= 3 && new Set(proColors).size === proColors.length,
    '三种促销徽章颜色两两不同(实际 ' + proColors.join(',') + ')');

// ---- .24 隐藏态元素(DomTT 提示框 / 表情面板): 渲染扫描抓不到, 必须主动按选择器查 ----
// 站点 `div.niceTitle{background:#7c98ae;color:#000}` 平时 visibility:hidden,
// 漏白扫描看的是"此刻可见" ⇒ 永远扫不到; 但一 hover 就在深色底上亮一块。
ok(/div\.niceTitle\{background:var\(--hdui-panel\) !important/.test(src),
    'DomTT 提示框(div.niceTitle)已深色化(.24: 平时隐藏, 扫描抓不到, hover 才露)');
ok(/div\.niceTitle\{[^}]*color:var\(--hdui-fg\) !important/.test(src),
    'DomTT 提示框文字已改为主题前景色(.24: 站点是黑字)');
ok(/div\.smilies td\{background:var\(--hdui-panel\) !important/.test(src),
    '论坛表情面板(div.smilies td)已深色化(.24: 与提示框同是 #7c98ae)');

// ---- .25 三个用户实拍问题(.25): dock / 嵌套置顶 / 搜索箱 ----
// dock: 旧版 background opacity .045 太低调, 用户说"切换按钮在原版 UI 中不明显"
ok(/\.dock\{display:flex;[^}]*background:rgba\(245,179,66,\.22\)/.test(src)
    || /\.dock\{[^}]*background:rgba\(245,179,66,\.22\)/.test(src),
    '切换按钮 (.dock) 用实底色金 22% opacity + 粗体(.25: 原 4.5% opacity 看不见)');
ok(/\.dock \.dot\{width:7px;height:7px;[^}]*box-shadow:0 0 6px/.test(src),
    'dock 加了发光 dot(.25)');
// 嵌套置顶: 标题格里嵌套的 tr.sticky_top 之前漏了, 露出站点默认白底
ok(/table\.searchbox[\s\S]*TN \+ '\.sticky_top/.test(src)
    || /\bTN \+ '\.sticky_top\{background:var\(--hdui-card\)/.test(src),
    '嵌套 tr.sticky_top 也加了背景(.25: 之前 43 个透明)');
// 搜索箱重新设计: 表格改卡片, 不能用 !important 破坏折叠
ok(/table\.searchbox\{[\s\S]*display:block/.test(src),
    '搜索箱改成卡片布局(.25: 用户说"完全重新设计")');
ok(/tbody\[id\^="ksearchbox"\]:not\(\[style\*="display: none"\]\)/.test(src),
    '搜索箱折叠态仍受尊重(.25: 不能用 !important 把折叠破坏)');

// ---- .23 进度指示器的状态色: 底色被压平后必须靠文字补回"做种/下载"的线索 ----
// 站点原靠底色区分(做种青 #44cef6 / 下载粉 #CC0066), 被 `[bgcolor]` 压成统一深色后两种状态一样了。
// 靠 translateLeeching() 打的 `data-hdui-prog` 标记给文字染色补回。
ok(/data-hdui-prog/.test(src) && /setAttribute\('data-hdui-prog'/.test(src),
    '进度格打了 data-hdui-prog 状态标记(.23: 底色压平后靠它区分做种/下载)');
ok(/td\[data-hdui-prog="seed"\][^{]*\{color:#7fb84e;\}/.test(src),
    '做种(seed)文字=绿 #7fb84e(.23)');
ok(/td\[data-hdui-prog="leech"\][^{]*\{color:#f5b342;\}/.test(src),
    '下载(leech)文字=琥珀 #f5b342(.23)');
// ⚠️ 必须连 font / b 一起选: 站点在 <font color="..."> 上写了自己的 color, 只染 td 会被盖掉
ok(/data-hdui-prog="seed"\] font/.test(src) && /data-hdui-prog="seed"\] b/.test(src),
    '状态色连 font 与 b 一起染(站点在 <font> 上写死了 color, 只染 td 会被盖掉)');

// ---- .22 列宽类规则必须片头+数据行**两边都写**(窄屏才暴露的错位) ----
// 标题列的 max-width 原来只写在数据行(tdSel = R), 片头没上限 ⇒
// 视口窄到"上限 < 可用空间"时(1024 视口: 上限 240 / 可用 256)片头标题 256、数据 240,
// 后面 11 列整体左移 16px。宽屏看不出来(1280: 上限 380 > 可用 256)。
ok(/\[tdSel\(m, 'title'\), hSel\(m, 'title'\)\]/.test(src),
    '标题列 max-width 同时作用于片头与数据行(.22: 只写数据行会在窄屏错位 16px)');
ok(/function hSel\(m, k\) \{ return m\[k\] \? \(H \+ ' > td' \+ C\(m, k\)\) : ''; \}/.test(src),
    '存在 hSel(片头列选择器)辅助函数(.22)');

// ---- .20 片头与数据行必须同一条列网格(用户实拍「标题栏错位」) ----
// 真站实测: 片头原 `padding:10px 0 9px`(左右 0)、数据行 `padding:7px 10px`(左右 10)
// ⇒ 12 列的表头全部比数据往左 10px。片头横向 padding 必须与数据行一致。
ok(/padding:10px 10px 9px/.test(src),
    '片头横向 padding=10px, 与数据行的 7px 10px 对齐(.20: 差 1px 就是整行错位)');
ok(/padding:7px 10px;background:var\(--hdui-card\)/.test(src),
    '数据行横向 padding=10px(.20: 片头要跟它一致)');

// ---- 表单元素深色化(.13): 搜索框 / 下拉框 / 按钮不该仍是白底 ----
const buildCssBlock = (src.match(/function buildCss\([^)]*\) \{([\s\S]*?)\n    \}/) || [])[1] || '';
ok(buildCssBlock.indexOf('html[data-hdui-theme] input[type=text]') >= 0,
    '表单 input[type=text] / select / textarea 已深色化(.13: 搜索框不应仍是白色)');
ok(/input\.btn:hover[^}]*var\(--hdui-accent\)/.test(buildCssBlock),
    '按钮 hover 转金底深字(.13: 「给我搜」按钮应有金边悬停)');

// ---- .14 兜底: 站点用 inline style 画的白底 + 工具栏 + 分页 ----
// 覆盖常见的写法(rgb/white/大小写/带不带空格), 删一条等于把那个写法漏出深色。
const INLINE_OK = [
    'background-color: rgb(255, 255, 255)', 'background-color:rgb(255,255,255)',
    'background-color: white', 'background-color: white', 'background-color: #fff', 'background-color:#fff',
    'background-color: #FFF', 'background-color:#FFF'
];
INLINE_OK.forEach(function (w) {
    ok(buildCssBlock.indexOf(w) >= 0,
        'inline style 白底兜底存在: [' + w + '](.14: 首页/论坛页那些标签还是白色就是因为漏了 inline)');
});
ok(/td\.toolbar,html\[data-hdui-theme\] td\.navigation/.test(buildCssBlock),
    '常见 NexusPHP 容器类 td.toolbar / td.navigation 已压深(.14)');

console.log('');
if (failed) {
    console.error('FAIL check-hdui-static: ' + failed + ' 项不达标');
    process.exit(1);
}
console.log('PASS check-hdui-static: 全部静态约束达标');
process.exit(0);
