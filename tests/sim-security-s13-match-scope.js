'use strict';
/**
 * S13 @match 作用域过宽(A7)
 * ------------------------------------------------------------------
 * 脚本 @match 一律写成 `*://*.域名/*`:
 *   · `*://` 含**明文 http**(可被 MITM 注入);
 *   · `*.` 覆盖**任意子域** —— 站点若有用户内容子域(上传的 HTML/头像页等), 脚本会在
 *     那里执行并注入面板, 与 S05 叠加后该子域可读出用户全部站点画像。
 * 运行时验证: 任意子域上脚本确实运行(注入了 UI); 但因 matchUnit 按 host 全等比较,
 * 不会匹配到 unit(不点击) —— 这点是对的, 记录为正向。
 */

const fs = require('fs');
const path = require('path');
const { withSim } = require('./sim/harness');
const { runCase, assert, assertEq } = require('./sim/tcase');

const SRC = path.join(__dirname, '..', 'src', 'PTAutoCheckIn.user.js');
const SUB = 'http://cdn.tangpt.top';

runCase('S13 @match 覆盖任意子域与明文 http', async () => {
    // --- 静态: 所有 @match 都是 *:// (含 http) 且带 *. 子域通配 ---
    const src = fs.readFileSync(SRC, 'utf8');
    const matches = Array.from(src.matchAll(/^\s*\/\/\s*@match\s+(\S+)/gm)).map((m) => m[1]);
    assert(matches.length > 0, '未解析到 @match');
    const wildcardScheme = matches.filter((m) => m.startsWith('*://'));
    const subdomainWildcard = matches.filter((m) => /\*:\/\/\*\./.test(m));
    console.log(`  静态: @match ${matches.length} 条, 其中 ${wildcardScheme.length} 条为 *://(含明文 http), ${subdomainWildcard.length} 条通配任意子域`);
    assertEq(wildcardScheme.length, matches.length, '并非全部 @match 都用了 *://(若已收紧为 https, 请更新本用例)');
    assert(subdomainWildcard.length > 0, '未发现 *. 子域通配');

    // --- 运行时: 任意子域上脚本会运行并注入 UI ---
    await withSim(async (sim) => {
        const page = await sim.open(`${SUB}/?sim=index`, { waitMs: 5000 });
        const probe = await page.eval(`
            const root = document.getElementById('ptac-root-v2');
            return { ui: !!root, err: (window.__simLogs || []).length };
        `);
        assert(probe.ui, '脚本未在任意子域上运行(说明 @match 已收紧, 本用例应更新)');
        const hits = sim.requests({ host: 'cdn.tangpt.top', path: '/attendance.php' });
        assertEq(hits.length, 0, '子域不应匹配到 unit(不应点击) —— 正向保证');
        console.log('  实测: 脚本在 cdn.tangpt.top(任意子域)上运行并注入了 UI, 但未匹配 unit 未点击');
        console.log('  残留风险: 该子域若承载用户内容, 仍可探测到脚本存在并触发 UI 分支; 收紧 @match 需真站回归(见 P29)。');
        await page.close();
    });
});
