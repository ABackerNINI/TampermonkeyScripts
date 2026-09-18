#!/usr/bin/env node
/*
 * run-all.js —— tests/ 目录的极简零依赖测试运行器
 *
 * 约定(见 tests/README.md):
 *   · tests/ 顶层每个 .js 文件 = 一个可独立运行的测试, **以退出码表达结果**(0=通过, 非 0=失败);
 *   · 下划线开头的文件(`_foo.js`)视为临时/草稿, 不参与; 运行器自身不参与;
 *   · tests/lib/、tests/fixtures/ 等子目录是共享代码与数据, 不会被当作测试执行。
 *
 * 用法:
 *   node tests/run-all.js              # 跑全部测试, 只对失败项打印子进程输出
 *   node tests/run-all.js -v           # 跑全部测试, 总是打印子进程输出
 *   node tests/run-all.js --list       # 只列出发现的测试, 不执行
 *   node tests/run-all.js --quiet      # 额外参数原样转发给每个测试(此例转发 --quiet)
 *
 * 零依赖: 只用 Node 内置模块; 不引入任何 npm 包, 与本仓库「无 package.json / 无构建」一致。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TESTS_DIR = __dirname;
const ROOT = path.join(TESTS_DIR, '..'); // 子进程 cwd 设为仓库根, 让测试里的相对路径一致
const SELF = path.basename(__filename);

const RUNNER_FLAGS = ['--list', '-l', '--verbose', '-v'];
const argv = process.argv.slice(2);
const listOnly = argv.some((a) => a === '--list' || a === '-l');
const verbose = argv.some((a) => a === '--verbose' || a === '-v');
const passthrough = argv.filter((a) => RUNNER_FLAGS.indexOf(a) < 0);

// 发现顶层测试文件(排除自身与下划线开头的草稿)
function discover() {
    return fs.readdirSync(TESTS_DIR, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.js'))
        .map((e) => e.name)
        .filter((n) => n !== SELF && n.charAt(0) !== '_')
        .sort();
}

const tests = discover();

if (!tests.length) {
    console.error('tests/ 下没有发现任何测试文件(.js)。');
    process.exit(2);
}

if (listOnly) {
    console.log(`发现 ${tests.length} 个测试(cwd = ${ROOT}):`);
    for (const t of tests) console.log(`  · ${t}`);
    process.exit(0);
}

console.log(`PTAutoCheckIn 测试套件 —— 共 ${tests.length} 个(零依赖运行器)`);
console.log('='.repeat(72));

const failed = [];
for (const name of tests) {
    const abs = path.join(TESTS_DIR, name);
    const t0 = Date.now();
    const res = spawnSync(process.execPath, [abs].concat(passthrough), {
        cwd: ROOT,
        encoding: 'utf8',
        // 输出量可能很大(如预算自检的全量表格), 给足缓冲避免截断
        maxBuffer: 32 * 1024 * 1024
    });
    const ms = Date.now() - t0;
    const out = `${res.stdout || ''}${res.stderr || ''}`;
    const pass = res.status === 0;

    console.log(`${pass ? '\u2714' : '\u2718'} ${name}  (${ms}ms, exit ${res.status === null ? 'null(被杀)' : res.status})`);

    if (!pass) {
        failed.push({ name, status: res.status, out });
        // 失败必须能看到原因: 打印子进程输出(缩进以便区分层级)
        if (out.trim()) {
            console.log('  ' + '-'.repeat(68));
            for (const line of out.replace(/\s+$/, '').split('\n')) console.log(`  | ${line}`);
            console.log('  ' + '-'.repeat(68));
        } else {
            console.log('  | (子进程无输出)');
        }
    } else if (verbose && out.trim()) {
        for (const line of out.replace(/\s+$/, '').split('\n')) console.log(`  | ${line}`);
    }
}

console.log('-'.repeat(72));
if (failed.length) {
    console.error(`\u2718 ${failed.length}/${tests.length} 个测试失败: ${failed.map((f) => f.name).join(', ')}`);
    process.exit(1);
}
console.log(`\u2714 全部 ${tests.length} 个测试通过。`);
