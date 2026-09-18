'use strict';
/**
 * GM API 垫片(注入页面, 在 userscript 之前执行)
 * ------------------------------------------------------------------
 * Tampermonkey 的 GM 存储是「脚本级、跨所有 @match 域共享」。本垫片用**同源相对路径**
 * 的同步 XHR 打到仿真服务器 /__gm/*, 由服务器持有唯一一份 store —— 精确复刻该语义
 * (各假站 host 不同, 浏览器 localStorage 是隔离的, 不能用)。
 *
 * 同步语义很重要: 真实 GM_getValue / GM_setValue 是同步的, 垫片必须同 semantics,
 * 否则测出来的行为就不是脚本的行为。
 *
 * 注意: 这是**测试垫片**, 只在 tests/sim/ 里, 生产代码一行不改(conventions.md §8.2)。
 */

const SHIM = [
    '(function () {',
    '    var BASE = "/__gm/";',
    '    function xhr(method, url, body) {',
    '        var x = new XMLHttpRequest();',
    '        x.open(method, url, false);', // 同步: 与真实 GM API 语义一致
    '        if (body !== undefined) { x.setRequestHeader("Content-Type", "text/plain;charset=utf-8"); x.send(body); }',
    '        else { x.send(); }',
    '        return x.responseText;',
    '    }',
    '    window.GM_getValue = function (key, def) {',
    '        try {',
    '            var r = JSON.parse(xhr("GET", BASE + "get?key=" + encodeURIComponent(key)));',
    '            return r && r.found ? r.value : def;',
    '        } catch (e) { return def; }',
    '    };',
    '    window.GM_setValue = function (key, value) {',
    '        try { xhr("POST", BASE + "set", JSON.stringify({ key: key, value: value })); }',
    '        catch (e) { try { console.error("[GM shim] set 失败", e); } catch (e2) {} }',
    '    };',
    '    window.GM_deleteValue = function (key) { window.GM_setValue(key, null); };',
    '    window.GM_log = function () {',
    '        try { console.log("[GM]", Array.prototype.slice.call(arguments).join(" ")); } catch (e) {}',
    '    };',
    '    // 真实 GM_openInTab 返回可操作的 tab 句柄; 垫片退化为 window.open(够用: 脚本只用于开标签)',
    '    window.GM_openInTab = function (url, opts) {',
    '        try { return window.open(url, "_blank"); } catch (e) { return null; }',
    '    };',
    '    window.__PTAC_SHIM__ = true;',
    '})();',
    ''
].join('\n');

module.exports = { SHIM };
