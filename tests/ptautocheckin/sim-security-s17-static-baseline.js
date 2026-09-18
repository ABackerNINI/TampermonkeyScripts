'use strict';
/**
 * S17 / S18 静态安全基线(无需浏览器, 秒级)
 * ------------------------------------------------------------------
 * · 无动态代码执行: eval / new Function / document.write / insertAdjacentHTML / unsafeWindow
 * · 无跨域外发能力: 未申请 GM_xmlhttpRequest / @connect(脚本除导航与 img 外不发请求)
 * · @grant 清单与实际使用的 GM API 一致(最小权限)
 */

const fs = require('fs');
const path = require('path');
const { runCase, assert, assertEq } = require('../lib/sim/tcase');

const SRC = path.join(__dirname, '..', '..', 'src', 'PTAutoCheckIn.user.js');

runCase('S17/S18 静态安全基线(无动态执行 / 无跨域外发 / @grant 最小集)', async () => {
    const src = fs.readFileSync(SRC, 'utf8');

    // --- 动态代码执行 ---
    const dynamic = [
        [/\beval\s*\(/, 'eval('],
        [/new\s+Function\s*\(/, 'new Function('],
        [/document\.write\s*\(/, 'document.write('],
        [/insertAdjacentHTML\s*\(/, 'insertAdjacentHTML('],
        [/\bunsafeWindow\b/, 'unsafeWindow']
    ];
    for (const [re, name] of dynamic) {
        assert(!re.test(src), `源码出现动态代码执行: ${name}`);
    }

    // --- 跨域外发能力 ---
    assert(!/GM_xmlhttpRequest/.test(src), '脚本使用了 GM_xmlhttpRequest(跨域请求能力)');
    assert(!/^\s*\/\/\s*@connect\s+/m.test(src), '脚本声明了 @connect');
    assert(!/GM_download|GM_fetch/.test(src), '脚本使用了其它外发类 GM API');

    // --- @grant 最小集 ---
    const grants = Array.from(src.matchAll(/^\s*\/\/\s*@grant\s+(\S+)/gm)).map((m) => m[1]).sort();
    const used = new Set(Array.from(src.matchAll(/\b(GM_[A-Za-z]+)\s*\(/g)).map((m) => m[1]));
    assertEq(grants.join(','), 'GM_getValue,GM_log,GM_openInTab,GM_setValue', '@grant 清单变化, 请复核最小权限');
    const undeclared = Array.from(used).filter((g) => !grants.includes(g));
    assertEq(undeclared.join(','), '', '用到了未声明 @grant 的 GM API: ' + undeclared.join(','));

    // --- 外链脚本加载 ---
    assert(!/<script[^>]+src\s*=\s*["']https?:/i.test(src), '源码内联引用了远端脚本');
});
