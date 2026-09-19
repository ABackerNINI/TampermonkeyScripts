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

// ---------- 4. 主题齐备与结构差异 ----------
section('4. 5 套主题与结构差异(不是只换颜色)');
const THEME_IDS = ['reel', 'tape', 'sheet', 'swiss', 'signal'];
const THEME_NAMES = ['片库索引', '电传纸带', '大开本', '瑞士网格', '播控台'];
for (let i = 0; i < THEME_IDS.length; i++) {
    const id = THEME_IDS[i];
    ok(new RegExp("id: '" + id + "'").test(src), '主题 ' + id + ' 已定义');
    ok(src.indexOf(THEME_NAMES[i]) >= 0, '主题中文名: ' + THEME_NAMES[i]);
}
ok(/DEFAULT_ID\s*=\s*'default'/.test(src) && /id:\s*DEFAULT_ID/.test(src), '提供「原站默认」可切回');

// 表格 / tbody / 行 的 display 声明必须出现多种取值 —— 证明布局骨架不同
const tableDisplays = new Set((src.match(/#torrenttable\{display:([a-z-]+)/g) || []).map(function (s) { return s.split(':')[1]; }));
const tbodyDisplays = new Set((src.match(/> tbody\{display:([a-z-]+)/g) || []).map(function (s) { return s.split(':')[1]; }));
const rowDisplays = new Set((src.match(/> tr[^{]*\{display:([a-z-]+)/g) || []).map(function (s) { return /display:([a-z-]+)/.exec(s)[1]; }));
ok(tableDisplays.size >= 2, '表格 display 取值 >= 2 种: ' + Array.from(tableDisplays).join(', '));
ok(tbodyDisplays.size >= 2, 'tbody display 取值 >= 2 种: ' + Array.from(tbodyDisplays).join(', '));
ok(rowDisplays.size >= 3, '行 display 取值 >= 3 种: ' + Array.from(rowDisplays).join(', '));

// 字体族也要有区别(衬线 / 等宽 / 无衬线)
const fonts = new Set((src.match(/--hdui-font':\s*'([^']+)'/g) || []).map(function (s) { return /'(.*)'/.exec(s)[1]; }));
ok(fonts.size >= 3, '字体族 >= 3 种: ' + fonts.size);

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
ok(/storeGet\(\s*STORE_THEME\s*,\s*DEFAULT_ID\s*\)/.test(src), '首次安装默认「原站默认」, 不自动上妆');
const pi = src.lastIndexOf('paintBootBgWhenPossible();');
const ri = src.indexOf("if (document.readyState === 'loading')");
ok(/@run-at\s+document-start/.test(src), '@run-at document-start 已声明');
ok(pi > 0 && ri > pi, '铺底色在 readyState 分支之前(真正的 document-start)');
ok(/E_BOOT_PAINT/.test(src), '铺底色异常有独立错误码');
ok(/function paintBootBgWhenPossible/.test(src) && /bootObserver\.observe\(document/.test(src),
    '连 <html> 都还没建时退化为「一出现就铺」, 不依赖 DOMContentLoaded');

console.log('');
if (failed) {
    console.error('FAIL check-hdui-static: ' + failed + ' 项不达标');
    process.exit(1);
}
console.log('PASS check-hdui-static: 全部静态约束达标');
process.exit(0);
