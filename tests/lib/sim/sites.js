'use strict';
/**
 * 仿真站点剧本库
 * ------------------------------------------------------------------
 * 每个剧本 = 一个假 PT 站页面的 HTML 生成器。
 * 剧本通过 URL 查询参数 ?sim=<name> 选择（脚本的 matchUnit 只比对 host + 部分 query,
 * 额外的 sim 参数不影响站点匹配, 因此零侵入）。
 *
 * 站点模型对齐 src/PTAutoCheckIn.user.js 里的 unit `tangpt`(躺平):
 *   url                      https://www.tangpt.top/
 *   checkInSelector          a[href*="attendance.php"]
 *   checkInContent           [签到得魔力]
 *   alreadyCheckedInContent  签到已得
 * 因此: 首页放 <a href="attendance.php">[签到得魔力]</a> 即"未签可点";
 *        /attendance.php 上放 <a href="attendance.php">签到已得…</a> 即"已签"。
 */

const BTN = 'attendance.php';
const CHECKIN_TEXT = '[签到得魔力]';
const CHECKED_TEXT = '签到已得';

function page(head, body) {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>SIM · PT</title>${head || ''}</head><body><div class="wrap">${body}</div></body></html>`;
}

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- 正常剧本 ----------
const NORMAL = {
    // 未签到: 有可点按钮
    index: () => page('', `<a href="${BTN}">${CHECKIN_TEXT}</a>`),
    // 已签到(首页按钮文案翻转)
    already: () => page('', `<a href="${BTN}">${CHECKED_TEXT} 30 魔力</a>`),
    // 签到落地页(点击后跳转目标): 默认即"已签", 让跳转型站点走通 success
    attended: () => page('', `<a href="${BTN}">${CHECKED_TEXT} 30 魔力</a><p>连续签到 12 天</p>`),
    // 同页 AJAX: 点击后按钮文案变已签, 不跳转
    ajax: () => page('',
        `<a id="btn" href="${BTN}">${CHECKIN_TEXT}</a>` +
        `<script>document.getElementById('btn').addEventListener('click',function(e){e.preventDefault();this.textContent='${CHECKED_TEXT} 30 魔力';});</script>`),
    // 无签到入口(选择器永不命中 → 未确认/超时路径)
    none: () => page('', '<p>页面无签到入口</p>'),
    // 慢响应: 首包延迟, 用于慢站/超时类断言
    slow: async (ctx) => { await sleep(ctx.delay || 3000); return NORMAL.index(); }
};

// ---------- HDHome 型: 已签后签到入口被纯文本取代(整页文本通道) ----------
// 对齐 src 里的 unit `hdhome`(url https://hdhome.org/index.php):
//   未签: 顶部信息栏有 <a href="attendance.php">签到得魔力</a>
//   已签: 该链接**消失**, 魔力值行内出现「(签到已得N)」纯文本(无按钮可查) → 已签判定
//         只能靠整页文本(alreadyPageCheck), 这正是该站与 tangpt 型的差别
const HDHOME = {
    'hdhome-index': () => page('',
        `<p><font class="color_bonus">魔力值 </font>[<a href="mybonus.php">使用</a>]: 10.4</p>` +
        `<a href="attendance.php" class="faqlink">签到得魔力</a>`),
    'hdhome-already': () => page('',
        `<p><font class="color_bonus">魔力值 </font>[<a href="mybonus.php">使用</a>]: 10.4&nbsp;(签到已得10)</p>`),
    // 入口已消失、但页面上**没有**「签到已得」文本(文本未刷新/文案改版) → 只能靠
    // alreadyCheck「入口消失 + 登录态证据」判已签
    'hdhome-gone': () => page('',
        `<p><font class="color_bonus">魔力值 </font>[<a href="mybonus.php">使用</a>]: 10.4</p>`),
    // 未登录(cookie 过期)/访客页: **同样没有**签到入口, 但也没登录态信息栏 —— 
    // 这是 noButtonMeansCheckedIn 会踩的坑(只看"入口没了"就判已签), 必须判为未签
    'hdhome-guest': () => page('',
        `<p><a href="login.php">登录</a> | <a href="signup.php">注册</a></p><p>请先登录后再浏览本站</p>`),
    // 签到落地页: 站方记账后短暂停留再跳回首页(此处用 meta refresh 复刻整页跳转)
    'hdhome-attended': () => page('<meta http-equiv="refresh" content="1;url=/index.php?sim=hdhome-already">',
        '<p>签到成功</p>')
};

// 按 host 的默认剧本(请求未带 ?sim= 时): 让同一套剧本库能同时服务不同页面模型的假站
const HOST_DEFAULT = {
    'hdhome.org': {
        '/': 'hdhome-index',
        '/index.php': 'hdhome-index',
        '/attendance.php': 'hdhome-attended'
    }
};

// ---------- 恶意剧本(安全用例用) ----------
const EVIL = {
    // A2: 外链 favicon → 存入 GM 存储 → 此后任意站开面板都会请求 evil.test(跨站信标)
    'evil-favicon-exfil': () => page(`<link rel="icon" href="http://evil.test/beacon.png">`, `<a href="${BTN}">${CHECKIN_TEXT}</a>`),
    // A2 正向: 本站(含子域 CDN) icon 应被正常采集
    'favicon-same-site': () => page(`<link rel="icon" href="/static/logo.png">`, `<a href="${BTN}">${CHECKIN_TEXT}</a>`),
    // A2: 协议过滤验证 — javascript: 伪协议不得落存储
    'evil-icon-javascript': () => page(`<link rel="icon" href="javascript:window.__iconJs=1">`, `<a href="${BTN}">${CHECKIN_TEXT}</a>`),
    // A2: 协议过滤验证 — data: 伪协议不得落存储
    'evil-icon-data': () => page(`<link rel="icon" href="data:text/html,%3Cscript%3Ewindow.__iconData=1%3C/script%3E">`, `<a href="${BTN}">${CHECKIN_TEXT}</a>`),
    // A5: 伪造签到按钮(同站任意参数) — 文案完全合规, 但 href 指向攻击者构造的同站 URL
    'evil-fake-button': () => page('', `<a href="${BTN}?action=DANGER">${CHECKIN_TEXT}</a>`),
    // A5: 伪造签到按钮(站外) — 选择器只匹配 href 子串, 站外 URL 同样能命中
    'evil-offsite-button': () => page('', `<a href="http://evil.test/${BTN}">${CHECKIN_TEXT}</a>`),
    // A1: 按钮文本里塞 HTML 载荷(以实体形式, 使 textContent 含尖括号)→ 被脚本抓取后进 GM 存储
    'evil-xss-text': () => page('',
        `<a href="${BTN}">${escHtml('<img src=x onerror="window.__pwned=1">')}${CHECKIN_TEXT}</a>`),
    // A8: 1MB 按钮文案 → 存储膨胀 / 渲染健壮性
    'evil-megatext': () => page('', `<a href="${BTN}">${'A'.repeat(1024 * 1024)}${CHECKIN_TEXT}</a>`),
    // A6: 伪造"已签到"文案(从未点过却显示已签)
    'evil-fake-success': () => page('', `<a href="${BTN}">${CHECKED_TEXT} 999 魔力</a>`)
};

const ALL = Object.assign({}, NORMAL, HDHOME, EVIL);

/**
 * 按 host + path + ?sim= 渲染一个仿真页面。
 * @returns {Promise<{status:number, body:string}>}
 */
async function renderPage(ctx) {
    const u = new URL(ctx.url);
    const hostDefault = HOST_DEFAULT[ctx.host];
    const name = u.searchParams.get('sim')
        || (hostDefault && hostDefault[ctx.path])
        || (ctx.path === '/attendance.php' ? 'attended' : 'index');
    const fn = ALL[name];
    if (!fn) {
        return { status: 404, body: page('', `<p>未知剧本: ${escHtml(name)}</p>`) };
    }
    return { status: 200, body: await fn(ctx) };
}

module.exports = { renderPage, scenarios: Object.keys(ALL), BTN, CHECKIN_TEXT, CHECKED_TEXT };
