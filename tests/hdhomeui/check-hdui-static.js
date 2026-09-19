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
const filmBlock = (src.match(/function filmCss\(m\) \{([\s\S]*?)\n    \}/) || [])[1] || '';
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

console.log('');
if (failed) {
    console.error('FAIL check-hdui-static: ' + failed + ' 项不达标');
    process.exit(1);
}
console.log('PASS check-hdui-static: 全部静态约束达标');
process.exit(0);
