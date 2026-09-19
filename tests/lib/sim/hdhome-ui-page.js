'use strict';
/**
 * 仿真剧本: HDHome(NexusPHP) 种子页 —— **结构化复刻, 零私有数据**
 * ------------------------------------------------------------------
 * 用于测试 src/HDHomeUI.user.js。真实结构取自 resources-do-not-track/ 下已脱敏的整页,
 * 但本文件**手写重建**: 选择器 / 类名 / 列序 / 事件挂载方式一一对齐, 内容与账号数据全部虚构。
 *
 * 依据 conventions.md §0.5: 给 tests/lib/sim/ 写剧本必须手写脱敏 HTML, 绝不拷贝私有目录文件。
 *
 * 变体(scenario):
 *   hdhome-ui            正常种子页(12 列, 12 行)
 *   hdhome-ui-broken    表头与数据行同时缺「进度」列 —— 列不可识别 E_COLUMN_UNKNOWN
 *   hdhome-ui-shape     仅数据行少一格 —— 行列数不符 ROW_CELL_COUNT_MISMATCH
 *   hdhome-ui-nocalc    外部脚本没注入 A / A·GB(表只有 10 列) —— 必须照常上妆, 不得回退
 *   hdhome-ui-empty     有表头无数据行 —— 空表体(不算错)
 *   hdhome-ui-notable   无 #torrenttable(模拟详情页/论坛页) —— 只上全局妆
 *   hdhome-ui-nonav     缺 #nav_block —— 结构契约 A 级失败 E_ANCHOR_MISSING
 */

const ROWS = 12;

// ---------- 站点自带样式(模拟 NexusPHP 默认观感, 作为"默认 UI"的基线) ----------
const SITE_CSS = `
body{margin:0;background:#2f4f6f;color:#fff;font:12px "Microsoft YaHei",Tahoma,sans-serif}
table.mainouter{background:#254061}
table.main{border:1px solid #000080;background:#2f4f6f}
td.embedded{background:#2f4f6f}
a{color:#fff}
#mainmenu a{display:inline-block;padding:4px 8px}
#mainmenu li{display:inline-block;list-style:none}
#mainmenu li.selected a{background:#000080}
table.torrents{border-collapse:collapse;background:#fff;color:#000}
table.torrents td{border:1px solid #b0c4de;padding:5px}
td.colhead{background:#000080;color:#fff;font-weight:bold}
td.rowfollow{background:#f4f4f9}
table.searchbox{background:#fff;color:#000}
#footer{text-align:center;padding:10px}
`;

// ---------- 站点自带脚本(模拟: 极简 jQuery 垫片 + RSS 切换 + 折叠 + 联想) ----------
const SITE_JS = `
(function () {
  function JQ(obj) {
    var els = typeof obj === 'string'
      ? Array.prototype.slice.call(document.querySelectorAll(obj))
      : [obj];
    return {
      click: function (fn) {
        els.forEach(function (el) { el.addEventListener('click', function (e) { fn.call(el, e); }); });
        return this;
      },
      data: function (k) { return els[0] ? els[0].getAttribute('data-' + k) : undefined; },
      hasClass: function (c) { return !!els[0] && els[0].classList.contains(c); },
      toggleClass: function (c) { els.forEach(function (el) { el.classList.toggle(c); }); return this; }
    };
  }
  JQ.get = function (url, data, cb) {
    var q = Object.keys(data || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
    }).join('&');
    var x = new XMLHttpRequest();
    x.open('GET', url + (q ? '?' + q : ''), true);
    x.onload = function () { if (cb) cb(x.responseText); };
    x.send();
  };
  window.jQuery = function (fn) { fn(JQ); };

  // 站点自身的 document 级监听: 用于验证「用户点我们面板时不会冒泡到站内」
  window.__siteDocClicks = 0;
  document.addEventListener('click', function () { window.__siteDocClicks++; });

  window.klappe_news = function (id) {
    var box = document.getElementById('k' + id);
    var pic = document.getElementById('pic' + id);
    if (!box) return;
    box.style.display = box.style.display === 'none' ? '' : 'none';
    if (pic) pic.className = box.style.display === 'none' ? 'plus' : 'minus';
  };
  window.suggest = function () {};
  window.noenter = function () { return true; };
  window.domTT_activate = function () {};
})();
`;

const RSS_JS = `
jQuery(function ($) {
  $('[data-toggle-rss]').click(function () {
    var that = $(this), id = that.data('toggle-rss');
    $.get('myrss.php', { ajax: 1, torrentid: id }, function () {
      try {
        window.plugins.toast.showExShortCenter(that.hasClass('on') ? 'Removed from MyRSS' : 'Added to MyRSS');
      } catch (e) {}
      that.toggleClass('on');
    });
  });
});
`;

// ---------- 片段生成 ----------
const NAV_ITEMS = [
  ['/index.php', '首页'], ['/forums.php', '论坛'], ['/torrents.php', '种子'], ['/live.php', 'LIVE'],
  ['/torrents.php?mystat=keep', '保种'], ['/torrents.php?mystat=dead', '断种'], ['/offers.php', '候选'],
  ['/viewrequests.php', '求种'], ['/upload.php', '发布'], ['/subtitles.php', '字幕'],
  ['/usercp.php', '控制面板'], ['/topten.php', '排行榜'], ['/log.php', '日志'],
  ['/rules.php', '规则'], ['/faq.php', '常见问题'], ['/staff.php', '管理组']
];

function navBlock(opts) {
    return `<table class="mainouter" width="982" cellspacing="0" cellpadding="5" align="center"><tbody><tr><td id="nav_block" class="text" align="center">`
        + `<table class="main" width="1250" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td class="embedded"><div id="nav"><ul id="mainmenu" class="menu">`
        + NAV_ITEMS.map(function (it, i) {
            return `<li${i === 2 ? ' class="selected"' : ''}><a href="${it[0]}">${it[1]}</a></li>`;
        }).join('')
        + `</ul></div></td></tr></tbody></table>`
        + infoBlock()
        + `</td></tr><tr><td id="outer" align="center" class="outer" style="padding-top: 20px">`
        + outerBody(opts)
        + `</td></tr></tbody></table>`;
}

function infoBlock() {
    return `<table id="info_block" cellpadding="4" cellspacing="0" border="0" width="100%"><tbody><tr>`
        + `<td><table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>`
        + `<td class="bottom" align="left"><span class="medium">欢迎回来, <span class="nowrap">`
        + `<a href="/userdetails.php?id=100001" class="User_Name"><b>SimUser</b></a></span> (UID: 100001 ) `
        + `[<a href="/logout.php">退出</a>] [<a href="/torrents.php?inclbookmarked=1&amp;allsec=1">收藏</a>] `
        + `[<a href="/myrss.php">RSS 下载筐</a>] <font class="color_bonus">魔力值 </font>`
        + `[<a href="/mybonus.php">使用</a>]: 12.3 <a href="/attendance.php" class="faqlink">签到得魔力</a> `
        + `<font class="color_bonus">做种积分：</font>0.0 <font class="color_invite">邀请 </font>`
        + `[<a href="/invite.php?id=100001">发送</a>]: 0/0 [<a href="/donate.php">捐赠本站</a>]<br>`
        + `<font class="color_ratio">分享率：</font> 1.00 <font class="color_uploaded">上传量：</font> 0.00 GB `
        + `<font class="color_downloaded"> 下载量：</font> 0.00 KB `
        + `<a href="/peerlist.php?userid=100001"><font class="color_active">当前活动：</font></a>`
        + `<img class="arrowup" alt="Torrents seeding" title="当前做种" src="/static/trans.gif">11 `
        + `<img class="arrowdown" alt="Torrents leeching" title="当前下载" src="/static/trans.gif">2 `
        + `<font class="color_slots">连接数：</font>无限制`
        + `</span></td>`
        + `<td class="bottom" align="right"><span class="medium">当前时间：00:57<br>`
        + `<a href="/messages.php"><img class="inbox" src="/static/trans.gif" alt="inbox" title="收件箱"></a> 1 (0 新) `
        + `<a href="/friends.php"><img class="buddylist" src="/static/trans.gif" alt="Buddylist" title="社交名单"></a> `
        + `<a href="/getrss.php"><img class="rss" src="/static/trans.gif" alt="RSS" title="获取RSS"></a>`
        + `</span></td></tr></tbody></table></td></tr></tbody></table>`;
}

function checkboxGroup(prefix, ids) {
    return ids.map(function (id) {
        return `<td align="left" class="bottom"><input type="checkbox" id="${prefix}${id}" name="${prefix}${id}" value="1">`
            + `<a href="/torrents.php?${prefix === 'cat' ? 'cat' : 'team'}=${id}"><img class="c_${prefix}${id}" src="/static/cattrans.gif" alt="${prefix}${id}" title="${prefix}${id}"></a></td>`;
    }).join('');
}

const TAGS = [['yc', '原创'], ['sf', '首发'], ['gy', '国语'], ['zz', '中字'], ['db', 'Dolby Vision'], ['hdr10', 'HDR10']];

function searchBox() {
    return `<form method="get" name="searchbox" action="/torrents.php?">`
        + `<table border="1" class="searchbox" cellspacing="0" cellpadding="5" width="100%"><tbody>`
        + `<tr><td class="colhead" align="center" colspan="2">`
        + `<a href="javascript: klappe_news('searchboxmain')"><img class="plus" src="/static/trans.gif" id="picsearchboxmain" alt="Show/Hide">搜索箱</a></td></tr></tbody>`
        + `<tbody id="ksearchboxmain" style="display: none">`
        + `<tr><td class="rowfollow" align="left"><table><tbody>`
        + `<tr><td class="embedded" colspan="17" align="left"><b>类型:</b></td></tr>`
        + `<tr>${checkboxGroup('cat', [438, 499, 450, 415])}</tr>`
        + `<tr><td class="embedded" colspan="17" align="left"><b>制作组:</b></td></tr>`
        + `<tr>${checkboxGroup('team', [1, 2, 3, 4])}</tr>`
        + `<tr><td class="embedded"><b>标签:</b>`
        + TAGS.map(function (t) {
            return `<span class="tags t${t[0]}" title="${t[1]}" style="cursor: pointer" onclick="javascript:location.href='?tag=${t[0]}'">${t[1]}</span>`;
        }).join('')
        + `</td></tr></tbody></table></td>`
        + `<td class="rowfollow" align="left">`
        + `<input id="searchinput" name="search" type="text" value="" autocomplete="off" style="width: 200px" `
        + `ondblclick="suggest(event.keyCode,this.value);" onkeyup="suggest(event.keyCode,this.value);" onkeypress="return noenter(event.keyCode);">`
        + `<div id="suggcontainer" style="display: none"><div id="suggestions"></div></div>`
        + `<select name="search_mode"><option value="0">AND</option><option value="1">OR</option><option value="2">精确</option></select>`
        + `<select name="search_area"><option value="0">标题</option><option value="1">简介</option><option value="2">发布者</option><option value="4">IMDB</option></select>`
        + `<select class="med" name="spstate"><option value="0">全部</option><option value="1">普通</option><option value="2">免费</option><option value="3">2X免费</option></select>`
        + `<select class="med" name="incldead"><option value="0">全部</option><option value="1">活跃</option><option value="2">断种</option></select>`
        + `<select class="med" name="inclbookmarked"><option value="0">全部</option><option value="1">已收藏</option></select>`
        + `<select name="tag"><option value=""></option><option value="yc">原创</option><option value="sf">首发</option></select>`
        + `</td></tr>`
        + `<tr><td class="rowfollow" align="center" colspan="2"><input type="submit" class="btn" value="给我搜"></td></tr>`
        + `</tbody></table></form>`;
}

function headRowText(label, cls, title) {
    return `<td class="colhead"${title ? ` title="${title}"` : ''}${cls ? ` id="${cls}"` : ''}>${label}</td>`;
}

function headRow(opts) {
    const cells = [
        headRowText('类型', '', ''),
        headRowText('标题', '', ''),
        `<td class="colhead"><a href="/torrents.php?sort=3&amp;type=desc"><img class="comments" src="/static/trans.gif" alt="comments" title="评论数"></a></td>`,
        `<td class="colhead"><a href="/torrents.php?sort=4&amp;type=desc"><img class="time" src="/static/trans.gif" alt="time" title="存活时间"></a></td>`,
        `<td class="colhead"><a href="/torrents.php?sort=5&amp;type=desc"><img class="size" src="/static/trans.gif" alt="size" title="大小"></a></td>`,
        `<td class="colhead"><a href="/torrents.php?sort=7&amp;type=desc"><img class="seeders" src="/static/trans.gif" alt="seeders" title="种子数"></a></td>`,
        `<td class="colhead"><a href="/torrents.php?sort=8&amp;type=desc"><img class="leechers" src="/static/trans.gif" alt="leechers" title="下载数"></a></td>`,
        `<td class="colhead"><a href="/torrents.php?sort=6&amp;type=desc"><img class="snatched" src="/static/trans.gif" alt="snatched" title="完成数"></a></td>`
    ];
    // 变体: 表头缺「进度」列(rowDrop 只改数据行 -> 制造"行列数不符")
    if (!opts || !opts.headDrop) cells.push(`<td class="colhead">进度</td>`);
    // A / A·GB 是**别的脚本**注入的列: noCalc 模拟它没装/还没跑完 —— 表只有 10 列
    if (!opts || !opts.noCalc) {
        cells.push(`<td class="colhead" style="cursor: pointer;" id="calcTHeadA" title="A值">A</td>`);
        cells.push(`<td class="colhead" style="cursor: pointer;" id="calcTHeadAve" title="每GB的A值">A/GB</td>`);
    }
    cells.push(`<td class="colhead"><a href="/torrents.php?sort=9&amp;type=desc">发布者</a></td>`);
    return `<tr>${cells.join('')}</tr>`;
}

/** 外部脚本补列的 DOM 片段(表头两格), 供用例在页面加载后再注入, 复现"补列比我们晚" */
function calcHeadCells() {
    return `<td class="colhead" style="cursor: pointer;" id="calcTHeadA" title="A值">A</td>`
        + `<td class="colhead" style="cursor: pointer;" id="calcTHeadAve" title="每GB的A值">A/GB</td>`;
}

/** 外部脚本补列的 DOM 片段(数据行两格), seeders 用来算一个假的 A 值 */
function calcRowCells(seeders) {
    return `<td class="rowfollow" data-calc-a="${(seeders / 4).toFixed(2)}">${(seeders / 4).toFixed(2)}</td>`
        + `<td class="rowfollow" data-calc-ave="0.08"><span>0.08</span></td>`;
}

const TITLES = [
    'Simulated Night 2024 COMPLETE 2160p UHD Blu-ray HEVC TrueHD 7.1-Fixture@SIMTV',
    'Quiet Harbour 1987 2160p Criterion Collection UHD Blu-ray HEVC LPCM1.0-DiY@SIM',
    'Blue Planet Reissue 2017 1080p Blu-ray AVC DTS-HD MA 5.1-MockGrp',
    'Hans Zimmer Live In Prague 2023 2160p WEB-DL HDR10+ AAC 2.0-FakeTeam',
    'Old Cinema Shorts Vol.3 1954 1080p Blu-ray AVC FLAC 2.0-DemoRip',
    'Mountain Documentary 2021 COMPLETE 2160p WEB-DL HDR10 AAC-Fixture',
    'City Symphony 1999 1080p Remux AVC DTS-HD MA 5.1-SimGroup',
    'Winter Concert 2022 2160p UHD Blu-ray HEVC Atmos-DemoTeam',
    'Desert Roads 2020 1080p WEB-DL AVC AAC 2.0-MockRip',
    'River Valley Chronicles S01 2019 COMPLETE 1080p WEB-DL-Fixture',
    'Silent Film Restored 1927 1080p Blu-ray AVC Silent-DemoGrp',
    'Analog Tape Sessions 1995 1080p WEB-DL AAC 2.0-FakeRip'
];
const CATS = ['c_tvseries_2160p', 'c_movies_4kuhd', 'c_movies_bluray', 'c_music_lossless',
    'c_document_1080p', 'c_tvseries_1080p', 'c_movies_remux', 'c_music_video',
    'c_tvseries_1080p', 'c_tvseries_1080p', 'c_movies_bluray', 'c_music_lossless'];

function torrentRow(i, opts) {
    const id = 300000 + i;
    const title = TITLES[i % TITLES.length];
    const cat = CATS[i % CATS.length];
    const seeders = [42, 98, 17, 6, 23, 31, 9, 55, 3, 71, 12, 27][i % 12];
    const leechers = [6, 4, 2, 1, 9, 5, 3, 11, 7, 14, 1, 8][i % 12];
    const size = [140.99, 60.62, 31.40, 8.12, 22.75, 51.30, 44.10, 78.90, 12.05, 96.40, 18.60, 5.44][i % 12];
    const cls = i < 2 ? ' class="sticky_top"' : '';
    return `<tr${cls}>`
        + `<td class="rowfollow nowrap" valign="middle" style="padding: 0px"><a href="/torrents.php?cat=${400 + i}"><img class="${cat}" src="/static/cattrans.gif" alt="${cat}" title="${cat}"></a></td>`
        + `<td class="rowfollow" width="100%" align="left"><table class="torrentname" width="100%"><tbody><tr${cls}>`
        + `<td class="embedded">${i < 2 ? '<img class="sticky" src="/static/trans.gif" alt="Sticky" title="置顶">' : ''}&nbsp;`
        + `<a title="${title}" href="/details.php?id=${id}&amp;hit=1"><b>${title}</b></a> `
        + `<span class="tags tfree" onmouseover="domTT_activate(this, event, 'content', '促销')">促销</span></td>`
        + `<td class="embedded rss"><a href="javascript:" class="" data-toggle-rss="${id}"><img src="/static/rss.png" alt="RSS" title="添加到 RSS"></a></td>`
        + `</tr></tbody></table></td>`
        + `<td class="rowfollow"><a href="/comment.php?action=add&amp;pid=${id}&amp;type=torrent" title="添加评论">0</a></td>`
        + `<td class="rowfollow nowrap"><span title="2026-09-17 19:56:48">1天<br>5时</span></td>`
        + `<td class="rowfollow">${size}<br>GB</td>`
        + `<td class="rowfollow" align="center"><b><a href="/details.php?id=${id}&amp;hit=1&amp;dllist=1#seeders">${seeders}</a></b></td>`
        + `<td class="rowfollow"><b><a href="/details.php?id=${id}&amp;hit=1&amp;dllist=1#leechers">${leechers}</a></b></td>`
        + `<td class="rowfollow"><a href="/viewsnatches.php?id=${id}"><b>${100 + i}</b></a></td>`
        + ((opts && opts.rowDrop) ? '' : `<td align="center">-</td>`)
        + ((opts && opts.noCalc) ? '' : `<td class="rowfollow" data-calc-a="${(seeders / 4).toFixed(2)}">${(seeders / 4).toFixed(2)}</td>`
            + `<td class="rowfollow" data-calc-ave="0.08"><span>0.08</span></td>`)
        + `<td class="rowfollow"><span class="nowrap"><a href="/userdetails.php?id=${120000 + i}" class="Uploader_Name"><b>simuploader</b></a></span></td>`
        + `</tr>`;
}

function pager() {
    return `<p align="center"><font class="gray"><b title="Alt+Pageup">&lt;&lt;&nbsp;上一页</b></font>&nbsp;&nbsp;`
        + [0, 1, 2].map(function (p) {
            return `<a href="/torrents.php?inclbookmarked=0&amp;incldead=1&amp;spstate=0&amp;page=${p}"><b title="Alt+Pagedown">${p * 100 + 1}&nbsp;-&nbsp;${(p + 1) * 100}</b></a>`;
        }).join(' | ')
        + `<br><a href="/torrents.php?page=1"><b title="Alt+Pagedown">下一页&nbsp;&gt;&gt;</b></a></p>`;
}

function outerBody(opts) {
    const o = opts || {};
    let body = `<p></p><table border="0" cellspacing="0" cellpadding="10"><tbody><tr><td>`
        + `<b><a href="/userdetails.php?id=100001"><font color="white">离新人考核结束还有 <span title="2026-10-18">29天</span></font></a></b>`
        + `</td></tr></tbody></table><p></p>`;
    if (!o.noTable) {
        body += `<table width="1100" class="main" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td class="embedded">`
            + searchBox()
            + pager()
            + `<table class="torrents" cellspacing="0" cellpadding="5" width="100%" id="torrenttable"><tbody>`
            + headRow(o)
            + (o.empty ? '' : Array.from({ length: ROWS }, function (_, i) { return torrentRow(i, o); }).join(''))
            + `</tbody></table>`
            + `<script>${RSS_JS}</script>`
            + pager()
            + `</td></tr></tbody></table>`;
    } else {
        body += `<table width="1100" class="main"><tbody><tr><td class="embedded"><h1>模拟详情页(无种子表)</h1></td></tr></tbody></table>`;
    }
    return body;
}

function page(opts) {
    const o = opts || {};
    const head = `<meta charset="utf-8"><title>SIM · HDHome</title><style>${SITE_CSS}</style><script>${SITE_JS}</script>`;
    const top = `<table class="head" align="center"><tbody><tr>`
        + `<td class="clear"><div class="logo_img"><img src="/static/logo.png" title="SIMHD"></div></td>`
        + `<td class="clear nowrap" align="right"><span id="ad_header"><a href="/adredir.php?id=1"><span><font>AD</font></span></a></span>`
        + `<a href="/donate.php"><img src="/static/donate.gif" alt="donate"></a></td></tr></tbody></table>`;
    const footer = `<div id="footer"><div align="center">(c) <a href="/">SIMHD</a> Powered by <a href="/aboutnexus.php">NexusPHP</a></div>`
        + `<div style="display:none" id="lightbox" class="lightbox"></div><div style="display:none" id="curtain" class="curtain"></div></div>`
        + `<script>var maxpage=3; var currentpage=0;</script>`;
    let main = '';
    if (o.noNav) {
        main = `<table class="mainouter"><tbody><tr><td id="outer" class="outer">${outerBody(o)}</td></tr></tbody></table>`;
    } else {
        main = navBlock(o);
    }
    return `<!doctype html><html lang="zh-CN"><head>${head}</head><body>${top}${main}${footer}</body></html>`;
}

const SCENARIOS = {
    'hdhome-ui': () => page({}),
    // 表头与数据行同时缺「进度」列 -> 列不可识别(E_COLUMN_UNKNOWN)
    'hdhome-ui-broken': () => page({ headDrop: true, rowDrop: true }),
    // 只少数据行的单元格 -> 行列数不符(ROW_CELL_COUNT_MISMATCH)
    'hdhome-ui-shape': () => page({ rowDrop: true }),
    // 外部脚本没注入 A / A·GB(表只有 10 列) -> 必须照常上妆, 不得回退
    'hdhome-ui-nocalc': () => page({ noCalc: true }),
    'hdhome-ui-empty': () => page({ empty: true }),
    'hdhome-ui-notable': () => page({ noTable: true }),
    'hdhome-ui-nonav': () => page({ noNav: true })
};

module.exports = { SCENARIOS, page, calcHeadCells, calcRowCells };
