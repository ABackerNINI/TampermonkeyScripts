'use strict';
/**
 * 仿真测试用例外壳: 统一的「浏览器门禁 + 断言 + 退出码」。
 * 约定与 tests/README.md 一致: 顶层 tests/*.js 每个文件 = 一个测试, 退出码表达结果。
 * 无浏览器时打印 SKIP 并退出 0(环境分级, 不是弱化断言)。
 */

const { findChrome } = require('./harness');

function assert(cond, msg) {
    if (!cond) throw new Error('断言失败: ' + msg);
}

function assertEq(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`断言失败: ${msg} — 期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
    }
}

async function runCase(name, fn) {
    // 门禁 1: 没有浏览器 -> 环境分级(SKIP), 不是弱化断言
    if (!findChrome()) {
        console.log(`SKIP ${name}: 未找到 Chrome/Edge(可用 SIM_CHROME 环境变量指定二进制路径)`);
        process.exit(0);
    }
    // 门禁 2: 全局 WebSocket 是 Node 22 才内置(cdp.js 零依赖就靠它)。
    //    Node 20 上 `new WebSocket` 会直接 ReferenceError —— 仿真用例会**失败**而不是跳过,
    //    于是 CI 的 Node 20 job 一直红(静态用例不受影响, 仍在跑)。
    //    与浏览器门禁同一套口径: 环境不具备就 SKIP, 具备就必须真过。
    if (typeof WebSocket === 'undefined') {
        console.log(`SKIP ${name}: 当前 Node(${process.version}) 没有全局 WebSocket(仿真用例需要 Node 22+)`);
        process.exit(0);
    }
    const t0 = Date.now();
    try {
        await fn();
        console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        process.exit(0);
    } catch (e) {
        console.error(`FAIL ${name}: ${e && e.stack ? e.stack : e}`);
        process.exit(1);
    }
}

/** 轮询等待 GM 存储满足谓词(脚本是异步写状态的, 必须轮询而不是固定 sleep) */
async function waitStore(sim, key, predicate, timeoutMs, label) {
    const deadline = Date.now() + (timeoutMs || 20000);
    let last;
    while (Date.now() < deadline) {
        const v = sim.get(key);
        last = v;
        if (v !== undefined && predicate(v)) return v;
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`等待存储 ${key} 超时(${label || ''}); 最后一次=${JSON.stringify(last)}`);
}

module.exports = { runCase, assert, assertEq, waitStore };
