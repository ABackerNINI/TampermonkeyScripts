// ==UserScript==
// @name         HDHomeUI
// @name:zh-CN   HDHome 界面主题套件
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.09.19.24
// @description  HDHome 界面主题: 胶片墙(齿孔片边 · 帧号 · 做种金), 可一键切回原站默认。纯样式层, 不重建 DOM、不接管交互, 原站功能全部保留; 开关内嵌在导航栏末尾(不占悬浮位、不与其它脚本的浮动按钮打架); A/A·GB 两列由其它脚本注入, 有或没有都能上妆、补进来会自动重摆; 搜索 / 下拉框 / 按钮等表单元素全部深色化(站点的白底在深色片基上刺眼); 标题格四个动作按钮(豆瓣/IMDb/下载/收藏)跟在标题后面同行; 导航栏页签(首页/论坛等)清掉站点的浅灰底; 站点自绘的图标(类别/促销/置顶图钉/推荐星/排序箭头/信箱等)全部换成主题 SVG; 表头六个指标列的概念图标(评论/存活/大小/做种/下载/完成)用概念图而非上下方向图标, 避免与「激活排序方向」混淆; 下载进度指示器的英文 "Leeching" 替换为中文「下载中」; 分享率、魔力值等统计值与数据行的暗红标记按主题重新上色(站点原色在深色底上几乎看不见); 滚动条 / 下拉弹层 / 自动填充等浏览器自带界面一并深色化; 非种子页(我的/论坛等)同样铺深色底, 站点用 inline style 画的白底/分页/工具栏容器一并压深, 不留大面积浅色块; 页面结构异常时先等结构就绪, 超时才提示并回退默认界面。
// @author       ABacker
// @license      GNU GPL-3.0
// @match        *://*.hdhome.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @tag          HDHome, theme, ui
// ==/UserScript==

(function () {
    'use strict';

    const ScriptName = 'HDHomeUI';
    const STORE_THEME = 'hdui.theme';
    const STORE_ERR = 'hdui.lastError';
    const DEFAULT_ID = 'default';   // 「原站默认」: 不上妆, 用户可主动切到它
    const FIRST_ID = 'film';        // 首次安装(存储里没有值)时默认上妆的主题
    const STYLE_ID = 'hdui-css';
    const BOOT_ID = 'hdui-boot';
    const ALERT_ID = 'hdui-alert';
    const ROOT_ID = 'hdui-root';

    // 入口内嵌尺寸(导航栏末尾的一个小胶囊钮, 不悬浮、不遮挡)
    // 27px 高 + 150px 宽 = 原型的 chip 尺寸(空心胶囊: 金边 + 6px 金点 + 三角)
    const DOCK_W = 150;
    const DOCK_H = 27;
    const DOCK_MODE = 'inline'; // 静态校验钉死: 不得退回 fixed 悬浮按钮
    // 导航右侧给入口预留的槽位宽度(见 --hdui-navreserve):
    // 真站 16 项在 ~1262px 视口下几乎占满一行, 不留槽位的话入口只能掉到下一行压住信息栏。
    const DOCK_RESERVE = DOCK_W + 8;

    // 种子表 12 列的字典(键 -> 表头识别方式)。站点加列/改名都能被 detectColumns 感知
    const COLUMNS = Object.freeze([
        'type', 'title', 'comments', 'alive', 'size', 'seeders',
        'leechers', 'snatched', 'progress', 'a', 'ave', 'uploader'
    ]);
    // 可选列: A / A/GB 这两列是**别的脚本**注入的(#calcTHeadA / #calcTHeadAve, 单元格带 data-calc-a),
    // 本脚本不能把它们当硬性契约 —— 那个脚本没装、没开、或者注入得比我们晚, 页面就只有 10 列。
    // 规则: 缺失只记日志并跳过这两列的排版, 照常上妆; 之后它们补进来了, 由结构守卫重摆一次。
    const OPTIONAL_COLUMNS = Object.freeze(['a', 'ave']);
    const REQUIRED_COLUMNS = Object.freeze(COLUMNS.filter(function (k) {
        return OPTIONAL_COLUMNS.indexOf(k) < 0;
    }));
    // 结构类错误码: 这类失败**先等一个窗口**再决定要不要弹横幅 —— 外部脚本补列是有时间差的,
    // 表头插了、数据行还没插完的瞬间就会命中 ROW_CELL_COUNT_MISMATCH, 直接弹横幅是误报。
    // 只等这一个码: E_COLUMN_UNKNOWN / E_ANCHOR_MISSING 都是"必需的东西没了",
    // 那是真坏了, 等也没用(拖 8 秒才报错只会让人以为脚本卡死), 直接回退。
    const STRUCT_CODES = Object.freeze(['ROW_CELL_COUNT_MISMATCH']);
    // 配置类错误: 不是页面结构坏了, 是 GM 存储里的值失效(主题被删 / 被手改成乱值)。
    // 与结构类分开 —— 结构类要「等窗口」, 配置类等也没用; 横幅措辞也不一样(见 showAlert)。
    const CONFIG_CODES = Object.freeze(['E_BAD_THEME']);
    // 2026.09.19.7 移除的旧 5 套。存储里还留着这些 id 的用户, 自动迁到胶片墙 ——
    // 他们本来就是「选过主题、想用主题」的人, 不该因为主题被删就退回无样式。
    const LEGACY_THEMES = Object.freeze(['reel', 'tape', 'sheet', 'swiss', 'signal']);
    const LEGACY_MIGRATE_TO = 'film';
    const PENDING_FIRST_MS = 8000;   // 首装/刷新: 那个脚本可能压根还没跑
    const PENDING_LATE_MS = 4000;    // 已上妆后结构变化: 大概率是它正在补列
    const PENDING_TICK_MS = 700;
    const PENDING_MAX_TRIES = 30;
    // A 级锚点: 缺任一即判定「不是认识的 HDHome 页面」, 直接回退
    const ANCHORS = Object.freeze([
        { sel: 'table.mainouter', label: '页面主框架 table.mainouter' },
        { sel: '#nav_block', label: '导航容器 #nav_block' },
        { sel: '#info_block', label: '用户信息栏 #info_block' },
        { sel: 'ul#mainmenu', label: '主导航 ul#mainmenu' }
    ]);

    // 类别色(按类别图标 class 前缀取色, 供 --hdui-cat 写入行上, 主题可自行取用)
    // ⚠️ 前缀清单与 ICON_CAT 保持同一份口径(含真站的 c_misc / c_cartoon / c_4kuhd 等),
    //    否则会出现「图标换对了、行上的 --hdui-cat 却是兜底灰」的错配。
    const CAT_COLORS = Object.freeze([
        ['c_tv', '#5b9fd4'], ['c_tvseries', '#5b9fd4'], ['c_tvshows', '#5b9fd4'],
        ['c_tvmusics', '#9b7fd4'], ['c_music', '#9b7fd4'], ['c_musics', '#9b7fd4'],
        ['c_movie', '#e05b4a'], ['c_movies', '#e05b4a'], ['c_4kuhd', '#e05b4a'],
        ['c_anime', '#e27ba6'], ['c_animate', '#e27ba6'], ['c_cartoon', '#e27ba6'],
        ['c_document', '#4fb89a'], ['c_doc', '#4fb89a'],
        ['c_sport', '#7fb84e'], ['c_sports', '#7fb84e'],
        ['c_misc', '#8b857c'], ['c_other', '#8b857c']
    ]);
    const CAT_FALLBACK = '#8b857c';

    // ==================================================================
    // 图标: 站内图片位一律换成内联 SVG(data URI), 实心 + 语义色
    //   来源: .workbuddy-ai/hdui-mock/film.html —— 已在 96 / 48 / 24 / 16px 四档对照下定稿,
    //         语义与形状都经过多轮用户选型(详见 memory-bank/pitfalls.md P38~P41)。
    //   铁律: 只改 CSS 的 content / background-image, 不增删站点 DOM —— 保持纯样式层。
    // ==================================================================

    // 行选择器放在图标层之前: 类别色块的 hover 加亮要用到(同特异性下"后写的胜出")
    const R = '#torrenttable > tbody > tr:not(:first-child)'; // 数据行
    const H = '#torrenttable > tbody > tr:first-child';       // 表头行

    function C(m, k) { return ':nth-child(' + m[k] + ')'; }

    const ICONS = Object.freeze({
        /* —— 类别 7 个 —— */
        movie: '<path fill-rule="evenodd" d="M5.6 3h12.8A2.6 2.6 0 0 1 21 5.6v12.8A2.6 2.6 0 0 1 18.4 21H5.6A2.6 2.6 0 0 1 3 18.4V5.6A2.6 2.6 0 0 1 5.6 3zm1.9 3.4v11.2h1.7V6.4zm8.5 0v11.2h1.7V6.4z"/>',
        tv: '<path d="M4.6 6.4h14.8A2.6 2.6 0 0 1 22 9v7.6A2.6 2.6 0 0 1 19.4 19H4.6A2.6 2.6 0 0 1 2 16.6V9a2.6 2.6 0 0 1 2.6-2.6z"/><path d="M8.4 2.6h7.2l-1.4 3.2H9.8z"/>',
        music: '<circle cx="7.3" cy="17.4" r="3.3"/><circle cx="17.6" cy="15.7" r="3.3"/>'
            + '<rect x="9.4" y="6" width="2.3" height="11.6" rx=".4"/><rect x="19.7" y="4.3" width="2.3" height="11.6" rx=".4"/>'
            + '<path d="M9.4 6.1l12.6-1.9v2.5L9.4 8.6z"/>',
        doc: '<path d="M13.6 2.6H6.9A1.9 1.9 0 0 0 5 4.5v15A1.9 1.9 0 0 0 6.9 21.4h10.2A1.9 1.9 0 0 0 19 19.5V8z"/>'
            + '<path d="M19 8.3h-5.1V3z" fill-opacity=".5"/>'
            + '<rect x="8.2" y="11.9" width="7.6" height="1.8" rx=".9" fill-opacity=".5"/>'
            + '<rect x="8.2" y="15.6" width="5.1" height="1.8" rx=".9" fill-opacity=".5"/>',
        anime: '<path d="M12 2.4l2.75 5.9 6.35.72-4.75 4.32 1.28 6.32L12 16.6l-5.63 3.06 1.28-6.32L3 9.02l6.35-.72z"/>',
        sport: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M4.2 8.4h15.6v2H4.2z M4.2 13.6h15.6v2H4.2z"/>',
        other: '<rect x="4" y="6.3" width="16" height="2.5" rx="1.25"/><rect x="4" y="10.75" width="16" height="2.5" rx="1.25"/>'
            + '<rect x="4" y="15.2" width="11" height="2.5" rx="1.25"/>',
        /* —— 表头指标 8 个 —— */
        /* 评论: 三个点必须是 evenodd 镂空 —— 同色图形叠画等于看不见(pitfalls P35) */
        comment: '<path fill-rule="evenodd" d="M2.5 6.5A2.5 2.5 0 0 1 5 4h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 17H9.5L5 21v-4H5A2.5 2.5 0 0 1 2.5 14.5z'
            + ' M4.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z'
            + ' M9.7 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z'
            + ' M15.2 10.4a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0z"/>',
        clock: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M11 6.6h2v5.3l3.5 2.1-.9 1.6-4.6-2.8z"/>',
        /* 大小 = 硬盘: 卡尺/表盘/柱图都被读成别的语义 */
        size: '<path fill-rule="evenodd" d="M4.5 5.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M6.2 9.6h7.2v3.2H6.2z"/>'
            + '<circle cx="17.2" cy="15.4" r="1.5"/>',
        up: '<path d="M12 3.6l7.2 7.2h-4.4v9.6H9.2v-9.6H4.8z"/>',
        down: '<path d="M12 20.4L4.8 13.2h4.4V3.6h5.6v9.6h4.4z"/>',
        check: '<path d="M20.4 6.3L9.9 16.8 4.2 11.1l1.85-1.85L9.9 13.1l8.65-8.65z"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4.6 20.6c0-4.1 3.3-7.4 7.4-7.4s7.4 3.3 7.4 7.4z"/>',
        rss: '<circle cx="5.8" cy="18.2" r="2.3"/>'
            + '<path d="M3.5 10.6a10.9 10.9 0 0 1 10.9 10.9h-3.3a7.6 7.6 0 0 0-7.6-7.6z"/>'
            + '<path d="M3.5 4.6a16.9 16.9 0 0 1 16.9 16.9h-3.3A13.6 13.6 0 0 0 3.5 7.9z"/>',
        /* —— 标题格里的 4 个行内动作(真站独有, 原型 film.html 没有) ——
         *   真站结构: 豆瓣/IMDb 是 <img src="/static/icon-douban.png">(**无 class**, 只能按 src 选),
         *             下载是 img.download、收藏是 img.delbookmark(都是 trans.gif + background 雪碧图)。
         *   站点用 `img.download{background:url(/static/png.png) -80px 0}` 画, 光换 content 不够 ——
         *   必须连 background-image 一起换(见 iconCss 的 ICON_ACTION)。
         *   选型(24×24 实心): 豆瓣=条目卡 / IMDb=屏幕+播放键 / 下载=下箭头进托盘 / 收藏=书签。
         *   配色避开金色(金只属于做种与交互态), 全部复用已有色板, 不新增色相。 */
        douban: '<path fill-rule="evenodd" d="M5 3.4h14a1.6 1.6 0 0 1 1.6 1.6v14a1.6 1.6 0 0 1-1.6 1.6H5A1.6 1.6 0 0 1 3.4 19V5A1.6 1.6 0 0 1 5 3.4z'
            + ' M6.9 7.6h10.2v1.7H6.9z M6.9 10.9h10.2v1.7H6.9z M6.9 14.2h7v1.7h-7z"/>',
        imdb: '<path fill-rule="evenodd" d="M3.4 5h17.2a1.6 1.6 0 0 1 1.6 1.6v10.8a1.6 1.6 0 0 1-1.6 1.6H3.4A1.6 1.6 0 0 1 1.8 17.4V6.6A1.6 1.6 0 0 1 3.4 5z'
            + ' M9.9 8.8l5.4 3.2-5.4 3.2z"/>',
        /* 下载 = 下箭头 + 底线(与纯下箭头 down 区分: 那个是"下载数"列的指标) */
        getdown: '<path d="M11 3.2h2v9.1l3.5-3.5 1.4 1.4-6 6-6-6 1.4-1.4L11 12.3z"/>'
            + '<rect x="4.2" y="19" width="15.6" height="2.2" rx="1.1"/>',
        /* 收藏 = 书签(真站 alt="Unbookmarked", 即"尚未收藏"的可点书签) */
        mark: '<path d="M6.2 3h11.6a1 1 0 0 1 1 1v17.2l-6.8-4.3-6.8 4.3V4a1 1 0 0 1 1-1z"/>',
        /* —— 片头「原本没有图标」的栏, 用 ::before 补上(原型 film.html 的 PF 表) ——
         * 真站这几格是**纯文字**(类型/标题/进度/A/A·GB/发布者), 站点不给图标;
         * 原型给它们各配了一个语义图形, 生产脚本当初漏搬 —— 列头左半截因此是光秃秃的文字。 */
        hcat: '<rect x="3.5" y="3.5" width="7.6" height="7.6" rx="1.6"/><rect x="12.9" y="3.5" width="7.6" height="7.6" rx="1.6"/>'
            + '<rect x="3.5" y="12.9" width="7.6" height="7.6" rx="1.6"/><rect x="12.9" y="12.9" width="7.6" height="7.6" rx="1.6"/>',
        htitle: '<rect x="4" y="5.2" width="16" height="2.7" rx="1.35"/><rect x="4" y="10.65" width="12" height="2.7" rx="1.35"/>'
            + '<rect x="4" y="16.1" width="8" height="2.7" rx="1.35"/>',
        hprog: '<rect x="3" y="9" width="18" height="6" rx="3" fill-opacity=".32"/><rect x="3" y="9" width="11" height="6" rx="3"/>',
        hcalc: '<path fill-rule="evenodd" d="M5.5 2.6h13a2 2 0 0 1 2 2v14.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V4.6a2 2 0 0 1 2-2z'
            + ' M6.8 6.2h10.4v3.6H6.8z M8 12.4h2.3v2.3H8z M13.7 12.4H16v2.3h-2.3z M8 16.9h2.3v2.3H8z M13.7 16.9H16v2.3h-2.3z"/>',
        /* A/GB = 天平(比值 / 每单位); 分段条读不出"比" */
        hratio: '<rect x="3" y="6" width="18" height="2.1" rx="1.05"/><rect x="11" y="3.6" width="2" height="15.4" rx="1"/>'
            + '<rect x="7" y="19" width="10" height="2.4" rx="1.2"/>'
            + '<path d="M5.4 8.8L2 14.6h6.8z"/><path d="M18.6 8.8l3.4 5.8h-6.8z"/>',
        /* —— 促销徽章 3 个(真站促销是 img.pro_*, 是替换元素, 伪元素不渲染 ⇒ 只能用图形表达) —— */
        prodown: '<path d="M11.2 3.4h1.6v9.1h3.3L12 17.6l-4.1-5.1h3.3z"/><circle cx="7.2" cy="19.4" r="1.7"/>'
            + '<circle cx="12" cy="19.4" r="1.7"/><circle cx="16.8" cy="19.4" r="1.7"/>',
        proFree: '<path d="M4.4 8.6h15.2v11.2a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6z"/>'
            + '<rect x="2.6" y="4.4" width="18.8" height="4.2" rx="1.4"/>'
            + '<rect x="11" y="4.4" width="2" height="17" rx="1"/>',
        pro2up: '<path d="M8.6 3.4h1.6v8.2h3.2L9.4 16.4 5.4 11.6h3.2z"/>'
            + '<path d="M15 12.2l2.6-2.6 2.6 2.6h-1.7v3.4h-1.8v-3.4z"/>'
            + '<rect x="3.4" y="19.2" width="17.2" height="2.4" rx="1.2"/>',
        /* —— 主题选择面板里的小图标(实心版) —— */
        frame: '<path fill-rule="evenodd" d="M4.4 4h15.2A1.4 1.4 0 0 1 21 5.4v13.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18.6V5.4A1.4 1.4 0 0 1 4.4 4z'
            + ' M5 7.6h14v1.8H5z M5 14.6h14v1.8H5z"/>',
        dot: '<circle cx="12" cy="12" r="3.4"/>',
        /* —— 导航 16 个 —— */
        home: '<path d="M12 2.5l9 8v11.5h-5.8V15H8.8v7H3V10.5z"/>',
        forum: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10L4 21v-4a2.5 2.5 0 0 1-1-2z"/>',
        /* 种子 = 一叠碟片; 磁铁/光盘都容易读错 */
        discs: '<path d="M3.8 17v2.6c0 1.55 3.67 2.8 8.2 2.8s8.2-1.25 8.2-2.8V17z"/><ellipse cx="12" cy="17" rx="8.2" ry="2.8"/>'
            + '<path d="M3.8 11v2.6c0 1.55 3.67 2.8 8.2 2.8s8.2-1.25 8.2-2.8V11z"/><ellipse cx="12" cy="11" rx="8.2" ry="2.8"/>'
            + '<path d="M3.8 5v2.6c0 1.55 3.67 2.8 8.2 2.8s8.2-1.25 8.2-2.8V5z"/><ellipse cx="12" cy="5" rx="8.2" ry="2.8"/>',
        live: '<circle cx="12" cy="12" r="2.7"/>'
            + '<path d="M7.2 7.2a6.8 6.8 0 0 0 0 9.6l1.5-1.5a4.7 4.7 0 0 1 0-6.6z"/>'
            + '<path d="M16.8 7.2l-1.5 1.5a4.7 4.7 0 0 1 0 6.6l1.5 1.5a6.8 6.8 0 0 0 0-9.6z"/>',
        leaf: '<path d="M20.5 3.5c-10 0-16.5 5-16.5 12 0 2.2.9 4.2 1.3 5 .3.6 1 .6 1.3 0 .4-.9 1.6-7.3 8.2-10.4 0 0-3.7 3-5.6 7.9 5.7 1.4 11.4-4.4 11.3-12.5z"/>',
        /* 断种 = 保种同一片叶形 + 右下锯齿缺角(缺口直接拼进路径, 不是内部挖孔 —— pitfalls P40) */
        wilt: '<path d="M 20.5 3.5 C 10.5 3.5, 4 8.5, 4 15.5 C 4 17.7, 4.9 19.5, 5.3 20.5 C 5.6 21.1, 6.3 21.1, 6.6 20.5 C 7 19.6, 8.2 13.2, 14.8 10.1 C 14.8 10.1, 11.1 13.1, 9.2 18 C 10.45 18.31, 11.71 18.27, 12.9 17.93 L 12.19 15.22 L 14.16 16.08 L 13.88 13.95 L 15.85 14.81 L 15.58 12.68 L 17.99 14.13 C 19.56 11.9, 20.54 8.9, 20.5 5.5 Z"/>',
        medal: '<circle cx="12" cy="9.2" r="6.6"/><path d="M12 14.4l-2.6 7 2.6-2 2.6 2z"/>',
        /* 求种 = 喇叭(吆喝求档); 放大镜更像"搜索" */
        horn: '<path d="M3.6 9.2v5.4c0 .9.7 1.6 1.6 1.6h2L15.6 22V2.2L7.2 7.6H5.2c-.9 0-1.6.7-1.6 1.6z"/>'
            + '<path d="M17.6 9.4a4.8 4.8 0 0 1 0 5.2l1.9 1.3a7.3 7.3 0 0 0 0-7.8z"/>',
        upload: '<path d="M12 2.6l6.6 6.6h-3.8v8.2H9.2V9.2H5.4z"/><rect x="3.4" y="19.2" width="17.2" height="2.8" rx="1.4"/>',
        subtitle: '<path d="M3.2 5h17.6a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H3.2A1.8 1.8 0 0 1 1.4 14.8v-8A1.8 1.8 0 0 1 3.2 5z"/>'
            + '<rect x="4.8" y="18.2" width="14.4" height="2.4" rx="1.2"/>',
        sliders: '<rect x="3" y="6.2" width="18" height="2.6" rx="1.3" fill-opacity=".5"/>'
            + '<rect x="3" y="10.7" width="18" height="2.6" rx="1.3" fill-opacity=".5"/>'
            + '<rect x="3" y="15.2" width="18" height="2.6" rx="1.3" fill-opacity=".5"/>'
            + '<circle cx="9" cy="7.5" r="2.5"/><circle cx="15.2" cy="12" r="2.5"/><circle cx="8" cy="16.5" r="2.5"/>',
        chart: '<rect x="3" y="10.5" width="4.4" height="10.5" rx="1.2"/><rect x="9.8" y="3.5" width="4.4" height="17.5" rx="1.2"/>'
            + '<rect x="16.6" y="14" width="4.4" height="7" rx="1.2"/>',
        logdoc: '<path d="M13.4 2.6H6.8A1.8 1.8 0 0 0 5 4.4v15.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8.2z"/>'
            + '<path d="M19 8.4h-5.3V3z" fill-opacity=".5"/>',
        shield: '<path fill-rule="evenodd" d="M12 2.6l8.5 3.1v6.4c0 5.2-3.7 8.4-8.5 9.5-4.8-1.1-8.5-4.3-8.5-9.5V5.7z'
            + ' M16.6 9.4l-5.4 5.4-2.7-2.7 1.5-1.5 1.2 1.2 3.9-3.9z"/>',
        book: '<path d="M12 6.6C10.4 5.3 8.4 4.6 6 4.6H3.4v13.2H6c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2h2.6V4.6H18c-2.4 0-4.4.7-6 2z"/>',
        /* ---- .16 补齐: 站点自绘、脚本此前完全没接管的 5 个图标族(真站整页扫描发现) ----
         * 图钉(置顶) / 星(推荐) / 信封(收件箱·发件箱) / 好友(好友列表), 排序箭头复用 up / down。
         * 图形一律 24×24 viewBox, 与既有字形同一套实心风格。 */
        pin: '<path d="M14.6 2.6l6.8 6.8-2.1 2.1-1.3-.4-3.6 3.6.6 3.9-1.7 1.7-4.3-4.3-.6 4.4-1.7-1.7.5-4.4-3.9-3.9'
            + '-1.3.6L2 12.6l6.8-6.8z"/><circle cx="9.4" cy="9.4" r="2.2" fill-opacity=".45"/>',
        star: '<path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/>',
        mail: '<rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2"/>'
            + '<path d="M3.4 6.6l8.6 6.6 8.6-6.6" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" fill="none"/>',
        plus: '<rect x="10.1" y="3.4" width="3.8" height="17.2" rx="1.4"/>'
            + '<rect x="3.4" y="10.1" width="17.2" height="3.8" rx="1.4"/>',
        people: '<circle cx="9" cy="8.2" r="3.4"/><circle cx="17" cy="9.4" r="2.4" fill-opacity=".55"/>'
            + '<path d="M2.8 20.4c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6z"/>'
            + '<path d="M15.6 15.2c2.6.2 4.6 1.9 4.6 4.4v.8h-3.2z" fill-opacity=".55"/>'
    });

    /**
     * 类别图标: [class 前缀, 图标名, 色]。
     *
     * ⚠️ 这份清单必须**覆盖真站实际出现过的全部类别家族**, 否则那一类只换尺寸不换图 ——
     *   而 `catsprites.css` 给的是 `img.c_xxx{width:45px;height:46px;background-position:-385px -8px}`,
     *   把按 45×46 算好的定位裁到 16×16 上, 看起来就是空白/碎片。
     *   真站前缀(统计自脱敏整页 200+ 行, 共 12 族):
     *     movies / movie / tvseries / tvshows / anime / cartoon / doc / musics / tvmusics / sports / misc / 4kuhd
     *   `c_other` 是原型里的名字, 真站用的是 `c_misc` —— 两个都留着。
     *
     * ⚠️ **顺序即优先级**: 这些规则特异性完全相同(都是属性选择器), 后写的胜出。因此
     *   宽前缀(`c_tv`)必须排在窄前缀(`c_tvseries` / `c_tvshows` / `c_tvmusics`)之前,
     *   否则 `c_tvmusics_mv` 会被 `c_tv` 抢走, 读成"剧集"而不是"音乐"。
     */
    const ICON_CAT = Object.freeze([
        ['c_tv', 'tv', '#5b9fd4'],
        ['c_tvseries', 'tv', '#5b9fd4'],
        ['c_tvshows', 'tv', '#5b9fd4'],
        ['c_tvmusics', 'music', '#9b7fd4'],
        ['c_music', 'music', '#9b7fd4'],
        ['c_musics', 'music', '#9b7fd4'],
        ['c_movie', 'movie', '#e05b4a'],
        ['c_movies', 'movie', '#e05b4a'],
        ['c_4kuhd', 'movie', '#e05b4a'],
        ['c_anime', 'anime', '#e27ba6'],
        ['c_animate', 'anime', '#e27ba6'],
        ['c_cartoon', 'anime', '#e27ba6'],
        ['c_document', 'doc', '#4fb89a'],
        ['c_doc', 'doc', '#4fb89a'],
        ['c_sport', 'sport', '#7fb84e'],
        ['c_sports', 'sport', '#7fb84e'],
        ['c_misc', 'other', '#8b857c'],
        ['c_other', 'other', '#8b857c']
    ]);

    /** 未命中任何家族时的兜底色(见 iconCss 里那条 `[class*="c_"]`) */
    const CAT_FALLBACK_COLOR = '#8b857c';

    /**
     * 促销徽章: 真站促销是 `<img class="pro_50pctdown|pro_free|pro_free2up">`(36×11 雪碧图),
     * **不是 `span.tags`**。原型的 `.tags.tfree` 在真站一条也匹配不到(`tfree` 只存在于原型/仿真页)。
     * ⚠️ `<img>` 是替换元素, 伪元素不渲染 ⇒ "带「促销」二字的药丸"用纯 CSS 做不到, 只能给图形徽章。
     */
    /**
     * ⚠️ .20 分色(用户实拍"种子缺少Free标记"): 三种促销**原来全是同一个金色** ——
     *    免费(pro_free) / 5折(pro_50pctdown) / 免费+双倍上传(pro_free2up) 长得一模一样,
     *    用户根本分不出哪个是 Free(真站 28 个 pro_free 全都渲染了, 只是和另外 42 个撞色)。
     *    现在按语义分色: 免费=绿(通行语义)、5折=琥珀、免费+双倍=紫(叠加的"更划算")。
     *    判据是「色相/饱和/亮度三者不能同时接近」, 与导航 16 色同一套纪律。
     */
    const PRO_BADGES = Object.freeze([
        ['pro_50pctdown', 'prodown', '#f5b342'],   // 5折 —— 琥珀
        ['pro_free', 'proFree', '#7fb84e'],        // 免费 —— 绿(PT 通行语义)
        ['pro_free2up', 'pro2up', '#9b7fd4']       // 免费 + 双倍上传 —— 紫
    ]);

    /**
     * 片头补充图标: 真站这几格**只有文字、没有图标**(类型/标题/进度/A/A·GB/发布者),
     * 原型给它们各配了一个语义图形并用 `::before` 补上。列号在 filmCss 里按 colMap 生成。
     */
    const HEAD_ICONS = Object.freeze([
        ['type', 'hcat', '#c9a86a'],
        ['title', 'htitle', '#7c8fd6'],
        ['progress', 'hprog', '#4fb89a'],
        ['a', 'hcalc', '#c98f4a'],
        ['ave', 'hratio', '#9b7fd4'],
        ['uploader', 'user', '#7c8fd6']
    ]);

    // 表头指标配色(按语义给, 全部有彩度 —— 不留灰)
    /**
     * 表头/行内指标图标: { class: [图标, 色] }。键名**就是**站点 `<img>` 的 class。
     *
     * ⚠️ .16 血泪: `alive` 与 `time` **必须都写**。列映射(colMap)里是把站点的 `time` 归到 `alive`
     *    这个**逻辑键**上的(见 `detectColumns` 的 `/\btime\b/ → 'alive'`), 但**图标选择器用的是 DOM 上
     *    真实的 class** —— 真站列头是 `<img class="time">`, 只写 `img.alive` 这条规则**一条都不命中**,
     *    于是 6 个指标图标里偏偏"存活"这一个还挂着站点的雪碧图(真站整页扫描: content=normal)。
     *    逻辑键与 DOM class 不是一回事, 别把两者混着用。
     */
    /**
     * 表头/行内指标图标(同一份用在数据行和表头 —— 但 HDHome 表头用 `<img class="seeders">` 当列图标,
     * 数据行里 seeders 只是纯数字, 所以这条规则**实际只在表头生效**)。
     *
     * ⚠️ .19 修订: `seeders`/`leechers` **不能再用 `up`/`down` 箭头形** —— 站点表头原本是概念图标
     *    (评论气泡/沙漏/磁盘/...), 我把它们换成 `up`/`down` 后**形状像"排序方向指示器"**,
     *    用户实拍报"未触发的标题箭头移除" —— 其实所有表头格子都有"看起来像箭头"的图标,
     *    但只有当前排序列才是真"激活"状态, 其它看着都是误报。
     *    改回概念图标: 做种→`leaf`(生长)、下载→`getdown`(下载), 看着不是箭头, 不再有歧义。
     *    代价: 失去"当前排序列的箭头指示"(但站点表头本身也没有, 见 prototype film.html)。
     */
    const ICON_MET = Object.freeze({
        comments: ['comment', '#5b9fd4'],
        alive: ['clock', '#9b7fd4'],
        time: ['clock', '#9b7fd4'],
        size: ['size', '#c98f4a'],
        seeders: ['leaf', '#7fb84e'],
        leechers: ['getdown', '#e05b4a'],
        snatched: ['check', '#4fb89a'],
        user: ['user', '#7c8fd6'],
        rss: ['rss', '#c9a86a']
    });

    /**
     * 标题格里的 4 个行内动作按钮: [选择器, 图标, 色]
     *
     * ⚠️ 真站的豆瓣 / IMDb 是 `<img src="/static/icon-douban.png">`(**没有 class**), 只能按 src 选;
     *    下载 / 收藏有 class(`download` / `delbookmark`), 但站点是拿 `background:url(png.png)` 画的 ——
     *    **只换 content 不够**: 站点的雪碧图背景会透在新图标底下, 看起来就是"图标没换成功"。
     *    所以这四个一律 content 与 background-image **双写同一个 SVG**(见 iconCss)。
     *
     * 配色: 全部复用已有色板(青绿 / 琥珀褐 / 蓝紫 / 粉), 避开金色 —— 金只属于做种数与交互态。
     */
    const ICON_ACTION = Object.freeze([
        ['img[src*="icon-douban"]', 'douban', '#4fb89a'],
        ['img[src*="icon-imdb"]', 'imdb', '#c9a86a'],
        ['img.download', 'getdown', '#7c8fd6'],
        ['img.delbookmark', 'mark', '#e27ba6']
    ]);

    /**
     * .16 补齐: 站点自绘、脚本此前**完全没接管**的图标族。[选择器, 图标, 色]
     *
     * 来源: 真站整页"站点残留装饰"扫描(P53 教训①"清样式要成对清"延伸出的排查), 共 5 族
     *   img.sticky(置顶图钉, 真站 100 行里 86 行) / img.star(推荐星) /
     *   img.arrowup + img.arrowdown(排序方向) / img.inbox + img.sentbox(信箱) / img.buddylist(好友)
     * ⚠️ 这些**不在 #torrenttable 里**(箭头与信箱在 `td.bottom` 底栏), 所以选择器不能加 `#torrenttable`
     *    前缀 —— 加了就一条都不生效。
     * ⚠️ 站点是拿 background-image 画的 ⇒ content 与 background-image 双写同一张(同 ICON_ACTION 的做法)。
     *
     * 配色: 图钉用琥珀(金只留给做种数与交互态), 星用金(它本身就是"推荐"的强调),
     *       箭头/信箱/好友一律压到弱灰 —— 底栏与行尾的小图标不该抢标题的注意力。
     */
    const ICON_MISC = Object.freeze([
        ['img.sticky', 'pin', '#c9a86a'],
        ['img.star', 'star', '#f5b342'],
        ['img.arrowup', 'up', '#a99e8b'],
        ['img.arrowdown', 'down', '#a99e8b'],
        ['img.inbox', 'mail', '#94a3b8'],
        ['img.sentbox', 'mail', '#94a3b8'],
        ['img.buddylist', 'people', '#94a3b8'],
        // 底栏那个独立的 RSS 订阅链接(标题格里的那个由 `.torrentname td.rss img` 那条单独管)
        ['img.rss', 'rss', '#c9a86a'],
        // 搜索区/列头的展开加号
        ['img.plus', 'plus', '#94a3b8']
    ]);

    // 导航 16 项: [href 片段, 图标, 颜色]
    //   顺序有讲究: 先给 torrents.php 兜底(种子), 再用 mystat=keep / mystat=dead 覆盖(保种/断种)
    //   配色纪律: 16 个色位要互不混淆 —— 判据是「色相差<=8 且 饱和差<=20 且 亮度差<=15」,
    //   三者都接近才算真分不出(只看色相会把"低饱和灰 vs 高饱和金"误判成撞色)。
    //   已避开的两处坑: ① logdoc 原 #57c9a8 与 discs #4fb89a 色相完全相同(163°);
    //                  ② 橙黄区原挤了 4 个, shield 往黄推会撞 wilt —— 干脆降饱和变灰而不是挪色相。
    const ICON_NAV = Object.freeze([
        ['index.php', 'home', '#eda23c'],
        ['forums.php', 'forum', '#5b9fd4'],
        ['torrents.php', 'discs', '#4fb89a'],
        ['live.php', 'live', '#e05b4a'],
        ['mystat=keep', 'leaf', '#7fb84e'],
        ['mystat=dead', 'wilt', '#b8933a'],
        ['offers.php', 'medal', '#e27ba6'],
        ['viewrequests.php', 'horn', '#9b7fd4'],
        ['upload.php', 'upload', '#e0762c'],
        ['subtitles.php', 'subtitle', '#3fb0c4'],
        ['usercp.php', 'sliders', '#7c8fd6'],
        ['topten.php', 'chart', '#a3c14a'],
        ['log.php', 'logdoc', '#94a3b8'],
        ['rules.php', 'shield', '#a99e8b'],
        ['faq.php', 'book', '#b48ad6'],
        ['staff.php', 'user', '#d4636f']
    ]);

    /**
     * .16 站点 `<font class="color_*">` 的统计值着色（底栏 td.bottom / 信息栏）。
     *
     * 真站一律 `#1900d1`（深蓝）—— 在深色片基上亮度差只有 **9**，等于看不见：
     * 分享率 / 魔力值 / 邀请 / 上传 / 下载 / 做种位 / 活跃这些恰恰是 PT 用户天天要看的数。
     * 各给一个能互相区分的色位（复用现有色板，不新造色）。
     */
    const INFO_COLORS = Object.freeze([
        ['color_ratio', '#f5b342'],      // 分享率 —— 金, 与做种数同一套"关键指标"语言
        ['color_bonus', '#c9a86a'],      // 魔力值 —— 琥珀
        ['color_uploaded', '#7fb84e'],   // 上传量 —— 绿
        ['color_downloaded', '#e05b4a'], // 下载量 —— 红
        ['color_invite', '#9b7fd4'],     // 邀请 —— 紫
        ['color_slots', '#7c8fd6'],      // 做种位 —— 蓝紫
        ['color_active', '#4fb89a']      // 活跃 —— 青绿
    ]);

    /**
     * .16 站点 `<font color="#xxxxxx">` 里**暗到看不见**的红（数据行里的强调标记）。
     *
     * 真站实测值（对比度扫描一轮轮抓的）：#dd0000 / #cc0000 / #bb0000 / #aa0000 / #990000 /
     * #8b0000 / #880000 / #800000 / #770000 / #660000 / #550000 / #440000 / #330000 / #220000 / #110000，
     * 最暗那条与片基亮度差只有 **3**。统一提亮成可读的红（保留"这是红色强调"的语义，不换色相）。
     * ⚠️ 只列**暗色**：亮色（如 #00cc00）在深色底上本来就看得清，没必要动，动了反而丢信息。
     * ⚠️ 这张表是**按值枚举**（CSS 拿不到"站点原本那个色"），漏一个值就漏一处暗字 ——
     *    以后真站再扫出新的暗红，往这里补即可（`_verify-hdui-real-render.js` 的【对比度】会报出来）。
     */
    const FONT_DARK_RED = Object.freeze([
        '#dd0000', '#cc0000', '#bb0000', '#aa0000', '#990000', '#8b0000', '#880000', '#800000',
        '#770000', '#660000', '#550000', '#440000', '#330000', '#220000', '#110000'
    ]);

    /**
     * 生成内联 SVG 的 data URI(实心 + 指定色)。
     * ⚠️ 必须带 width/height: 这些图是给 `img{content:url(...)}` 用的,
     *    SVG 只写 viewBox 的话**没有固有尺寸**, 替换内容后 img 宽高会算成 0,
     *    把外面包它的 <a> 一起压没了(hit-test 失败、点不到)。主题再用自己的规则缩到 12/16px。
     */
    function iconUri(name, color) {
        const body = ICONS[name] || ICONS.other;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="'
            + (color || '#8b857c') + '">' + body + '</svg>';
        return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }

    /** #rrggbb + alpha -> rgba() */
    function rgba(hex, alpha) {
        let h = String(hex).replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    /**
     * 图标替换 CSS(类别 / 促销 / 表头指标 / RSS / 标题格内 4 个行内动作)。
     * 只写 content + 底色, 不写死尺寸 —— 各主题用更高特异性的选择器自己定 width/height。
     *
     * ⚠️ **background-image 必须显式清掉**(这是「图标未成功替换」的真因):
     *    真站 `catsprites.css` 是 `img[class*="c_"]{background-image:url(catsprites.png) !important}`,
     *    `img.download{background:url(png.png) -80px 0}`。带 `!important` 的背景图**压不过普通声明**,
     *    写 `background:rgba(...)` 简写里的 background-image:none 是普通声明 —— 根本清不掉。
     *    结果: 换上去的 SVG 底下还透着 45×46 的雪碧图, 而它的 background-position 是按 45×46 算的,
     *    裁到 22px 上就是一块碎片/空白 —— 看起来正是"图标没换"。
     *    所以一律改成 `background-image:none !important` + `background-color:`(色块单独给)。
     */
    function iconCss() {
        const out = [];
        // 兜底: 任何带 `c_` 前缀的类别图标先给一个「其他」图形 + 灰块。
        // 真站的类别家族会随改版增加(c_cartoon / c_misc / c_4kuhd 就是这么冒出来的),
        // 没有兜底的话, 未命中的那一类**只被压尺寸、没被换图** ——
        // 而 catsprites.css 给的是 45×46 的 background-position, 裁到 16×16 上就是空白/碎片。
        // ⚠️ 必须排在所有具体家族之前(同特异性下后写的胜出)。
        out.push('html[data-hdui-theme] #torrenttable img[class*="c_"]{content:'
            + iconUri('other', CAT_FALLBACK_COLOR)
            + ';display:inline-block;vertical-align:middle;box-sizing:content-box;'
            + 'background-image:none !important;background-repeat:no-repeat;'
            + 'background-position:center;background-color:' + rgba(CAT_FALLBACK_COLOR, 0.16) + ';}');
        ICON_CAT.forEach(function (x) {
            out.push('html[data-hdui-theme] #torrenttable img[class*="' + x[0] + '"]{content:'
                + iconUri(x[1], x[2]) + ';background-image:none !important;'
                + 'background-color:' + rgba(x[2], 0.16) + ';}');
        });
        // 行 hover 时色块加亮(原型: 16% -> 26%); 兜底那条先写, 家族色后写覆盖它。
        // 只改 background-color —— background-image 已在基础规则里被 !important 清成 none。
        out.push('html[data-hdui-theme] ' + R + ':hover img[class*="c_"]{background-color:'
            + rgba(CAT_FALLBACK_COLOR, 0.26) + ';}');
        ICON_CAT.forEach(function (x) {
            out.push('html[data-hdui-theme] ' + R + ':hover img[class*="' + x[0] + '"]{background-color:'
                + rgba(x[2], 0.26) + ';}');
        });
        // 促销徽章(真站是 img.pro_*, 不是标签)。站点用 `background:url(icons.gif)` 简写(无 !important),
        // 这里也一并显式清掉, 免得站点改版加上 !important 后旧账重来。
        PRO_BADGES.forEach(function (x) {
            out.push('html[data-hdui-theme] #torrenttable img.' + x[0] + '{content:'
                + iconUri(x[1], x[2]) + ';background-image:none !important;}');
        });
        for (const k in ICON_MET) {
            if (!Object.prototype.hasOwnProperty.call(ICON_MET, k)) continue;
            const pair = ICON_MET[k];
            out.push('html[data-hdui-theme] #torrenttable img.' + k + '{content:' + iconUri(pair[0], pair[1])
                + ';background-image:none !important;}');
        }
        // ---- 标题格里的 4 个行内动作: 豆瓣 / IMDb / 下载 / 收藏 ----
        // ⚠️ content 与 background-image **双写同一个 SVG**: 站点是拿 `background:url(png.png)` 画
        //    下载/收藏的, 只换 content 的话雪碧图仍透在底下; 两个都换成同一张, content 万一失效
        //    (例如站点给 img 加了 object-fit 之类)背景层还能兜住, 不会退回"没换"。
        ICON_ACTION.forEach(function (x) {
            const u = iconUri(x[1], x[2]);
            out.push('html[data-hdui-theme] #torrenttable ' + x[0] + '{content:' + u
                + ';background-image:' + u + ' !important;background-size:contain;'
                + 'background-repeat:no-repeat;background-position:center;}');
        });
        // ⚠️ RSS 只换 `td.rss` 里那一个。
        //    旧写法是 `#torrenttable .torrentname img` —— 那会把标题格里**所有** img
        //    (置顶图钉 / 促销徽章 / 下载 / 收藏 / 豆瓣 / IMDb)统统换成 RSS 图标。
        //    旧仿真页的标题格里只有 RSS 一个 img, 所以这个 bug 一直没暴露。
        out.push('html[data-hdui-theme] #torrenttable .torrentname td.rss img{content:'
            + iconUri('rss', ICON_MET.rss[1]) + ';background-image:none !important;}');
        // ---- .16 站点自绘、此前完全没接管的 5 族: 图钉 / 星 / 排序箭头 / 信箱 / 好友 ----
        // 同 ICON_ACTION: content 与 background-image 双写同一张(站点拿 background 画, 只换 content 会透底)。
        // ⚠️ 无 #torrenttable 前缀: 箭头与信箱在底栏 td.bottom, 加了前缀就一条都不生效。
        ICON_MISC.forEach(function (x) {
            const u = iconUri(x[1], x[2]);
            out.push('html[data-hdui-theme] ' + x[0] + '{content:' + u
                + ';background-image:' + u + ' !important;background-size:contain;'
                + 'background-repeat:no-repeat;background-position:center;}');
        });
        return out.join('\n');
    }

    /**
     * 导航图标(::before)。tape 主题用 ::before/::after 画方括号, 会冲突 —— 由 theme.navIcons 关掉。
     */
    function navIconCss() {
        const out = [
            'html[data-hdui-theme] ul#mainmenu li a{display:flex;align-items:center;gap:6px;}',
            'html[data-hdui-theme] ul#mainmenu li a::before{content:"";flex:0 0 15px;width:15px;height:15px;'
            + 'background-repeat:no-repeat;background-position:center;background-size:contain;'
            + 'opacity:.85;transition:opacity .14s;}',
            'html[data-hdui-theme] ul#mainmenu li a:hover::before{opacity:1;}',
            // 末 6 项的图标跟着字号一起收一档(原型: 12px / opacity .6)
            'html[data-hdui-theme] ul#mainmenu li:nth-child(n+11) a::before{flex:0 0 12px;width:12px;'
            + 'height:12px;opacity:.6;}'
        ];
        ICON_NAV.forEach(function (x) {
            out.push('html[data-hdui-theme] ul#mainmenu li a[href*="' + x[0] + '"]::before{background-image:'
                + iconUri(x[1], x[2]) + ';}');
        });
        return out.join('\n');
    }

    // ==================================================================
    // 诊断账本: 所有异常的唯一出口。禁止空 catch、禁止静默吞错
    // ==================================================================
    const Diag = (function () {
        const items = [];
        const MAX = 60;
        const listeners = [];

        function emit(level, code, detail) {
            const rec = { level: level, code: code, detail: String(detail === undefined ? '' : detail), t: Date.now() };
            items.push(rec);
            if (items.length > MAX) items.shift();
            const line = '[' + ScriptName + '] ' + level.toUpperCase() + ' ' + code + ' ' + rec.detail;
            if (level === 'error') console.error(line);
            else if (level === 'warn') console.warn(line);
            else console.log(line);
            for (let i = 0; i < listeners.length; i++) {
                try { listeners[i](rec); } catch (e) { console.error('[' + ScriptName + '] 诊断订阅者异常', e); }
            }
            return rec;
        }

        return {
            info: function (code, detail) { return emit('info', code, detail); },
            warn: function (code, detail) { return emit('warn', code, detail); },
            error: function (code, detail) { return emit('error', code, detail); },
            // catch 的统一落点: catch (e) { Diag.fail('CODE', e); }
            fail: function (code, err) {
                return emit('error', code, (err && err.message) ? err.message : String(err));
            },
            list: function () { return items.slice(); },
            last: function (level) {
                for (let i = items.length - 1; i >= 0; i--) {
                    if (!level || items[i].level === level) return items[i];
                }
                return null;
            },
            onChange: function (fn) { listeners.push(fn); }
        };
    })();

    // ==================================================================
    // 版式工具
    // ------------------------------------------------------------------
    // 一条种子 = 一条「记录」, 拆成三个信息区, 由每套主题各自摆位:
    //   主行(类别 + 标题) / 指标带(做种·下载·完成·大小·存活·评论) / 尾注(进度·A·A/GB·发布者)
    // 关键: 每个数值都是「标签 + 值」的独立块, 不再让 12 个格子挤在同一行里飘。
    // ==================================================================

    // ==================================================================
    // 主题: 胶片墙 —— 一条种子 = 一格胶片帧
    //   片基左右各一条齿孔轨道; 帧号打在左侧片边; 片头(表头)吸顶且每列可排序;
    //   做种数是唯一的视觉锚点(20px 金色 + 内嵌占比条); 数值靠字号分层, 不靠色相。
    // ==================================================================

    // 列宽: 表头与数据行共用同一套 flex-basis, 数值才能成列对齐(0 = 占满剩余宽度)
    /**
     * ⚠️ .20: `progress` 原为 40px, 放不下「进度」列头(::before 图标 15px + gap 5px + 文字 ~23px
     *    = 43px)⇒ 列头被裁 3px(真站「文本截断」扫描抓到); 数据行的"100% / 做种中"两行也挤。
     *    加宽到 48px 后两边都够。这是**表头与数据行共用**的同一套 flex-basis, 改一处两边都变。
     */
    const FILM_W = {
        type: 44, title: 0, comments: 54, alive: 64, size: 78, seeders: 72,
        leechers: 58, snatched: 64, progress: 48, a: 52, ave: 56, uploader: 104
    };
    const FILM_GAP = 10;
    // 唯一强调色。抽成常量是因为有好几处 rgba() 要用它(原型里金有 .12/.13/.14/.16/.26 五档),
    // 散着写 hex 的话改一次色要满文件找。
    const FILM_ACCENT = '#f5b342';
    // 标题格的内嵌表(站内自带结构): 真站是三格 —— 标题 / 豆瓣IMDb+下载收藏 / RSS
    const TN = '#torrenttable table.torrentname > tbody > tr';
    const TN_TITLE = TN + ' > td:first-child';
    const TN_META = TN + ' > td.embedded:not(.rss):not(:first-child)';

    /** 数据行某列的选择器; 列缺席时返回空串 —— 绝不能生成 :nth-child(undefined) */
    function tdSel(m, k) { return m[k] ? (R + ' > td' + C(m, k)) : ''; }

    /** 同上, 但作用于片头行。列宽类规则必须**两边都写**(见 FILM_W 那节的 .21 教训) */
    function hSel(m, k) { return m[k] ? (H + ' > td' + C(m, k)) : ''; }

    /** 一组列合成一条规则; 整组都缺席时返回空串(避免产生裸 "{}") */
    function tdRule(m, keys, decl) {
        const s = keys.filter(function (k) { return !!m[k]; })
            .map(function (k) { return R + ' > td' + C(m, k); });
        return s.length ? s.join(',') + '{' + decl + '}' : '';
    }

    /** 同上, 但作用于片头行 */
    function hRule(m, keys, decl) {
        const s = keys.filter(function (k) { return !!m[k]; })
            .map(function (k) { return H + ' > td' + C(m, k); });
        return s.length ? s.join(',') + '{' + decl + '}' : '';
    }

    /**
     * 胶片墙: 齿孔片边 + 帧号 + 吸顶片头; 数值成列右对齐, 做种数是唯一大字。
     * headText: 哪些列头**本来就有文字**(见 detectColumns) —— 决定要不要用 ::after 补栏名。
     */
    function filmCss(m, headText) {
        const HOLE = '#6a5a48';   // 齿孔: 比片基明显亮, 做出"透光"感
        const GAP = FILM_GAP + 'px';
        const htxt = headText || {};

        // 片头: 原本只有图标没有栏名的列, 补中文标签(纯 CSS ::after, 不写 DOM)
        const LABEL = { comments: '评论', alive: '存活', size: '大小', seeders: '做种',
            leechers: '下载', snatched: '完成', uploader: '发布者' };
        const headLabels = [];
        Object.keys(LABEL).forEach(function (k) {
            if (!m[k]) return;
            const h = H + ' > td' + C(m, k);
            // ⚠️ 真站的「发布者」列头**自带文字**(`<td class="colhead"><a>发布者</a></td>`),
            //    而「评论/存活/大小/做种/下载/完成」是只有 `<img>` 的格。
            //    原型把发布者也当成"只有图标"的格, 于是脚本又补了一遍 ⇒ 真站渲染成「发布者 发布者 ↓」。
            //    有文字的列只补排序箭头, 不补栏名。
            if (!htxt[k]) {
                headLabels.push(h + ' a::after{content:"' + LABEL[k] + '";font-size:10.5px;letter-spacing:0;}');
            }
            headLabels.push(h + ' a[href*="type=desc"]::after{content:"'
                + (htxt[k] ? '' : LABEL[k]) + ' ↓";}');
            headLabels.push(h + ' a[href*="type=asc"]::after{content:"'
                + (htxt[k] ? '' : LABEL[k]) + ' ↑";}');
        });

        // 片头补充图标: 真站这几格只有文字、没有图标(类型/标题/进度/A/A·GB/发布者), 用 ::before 补
        const headIcons = [];
        HEAD_ICONS.forEach(function (x) {
            if (!m[x[0]]) return;
            headIcons.push(H + ' > td' + C(m, x[0]) + '::before{content:"";display:inline-block;'
                + 'width:13px;height:13px;margin-right:6px;vertical-align:-2px;'
                + 'background-repeat:no-repeat;background-position:center;background-size:contain;'
                + 'background-image:' + iconUri(x[1], x[2]) + ';}');
        });

        // 列宽: 表头与数据行各一份
        const basis = [];
        Object.keys(FILM_W).forEach(function (k) {
            if (!m[k]) return;
            const decl = FILM_W[k] ? 'flex:0 0 ' + FILM_W[k] + 'px' : 'flex:1 1 0';
            basis.push(H + ' > td' + C(m, k) + '{' + decl + ';min-width:0;}');
            basis.push(R + ' > td' + C(m, k) + '{' + decl + ';min-width:0;}');
        });

        return [
            // contain:inline-size 是撑宽问题的**根治手段**:
            //   站点外层是 `table-layout:auto`, 表格会被内容的 min-content 撑开 —— 而我们的行是
            //   flex + `flex:0 0 Npx` 的固定列, **不能收缩**, 于是整张表的 min-content 被顶到
            //   内容宽度, `table.mainouter` 跟着从 1130 涨到 1250(实测文档宽 1247 → 1250)。
            //   inline-size 让表格的**行内尺寸与内容无关**, min-content 归零 ⇒ 表格老老实实 100%,
            //   标题列自动拿到"剩下的那一截"(实测 262px), 不再依赖任何魔数。
            //   (不支持该属性的老浏览器退化为标题列的 max-width 兜底, 最多宽 3px。)
            '#torrenttable{display:block;padding:8px 0 20px;contain:inline-size;}',
            // 片基
            '#torrenttable > tbody{display:flex;flex-direction:column;position:relative;'
            + 'counter-reset:frame;padding-left:34px;padding-right:26px;}',
            '#torrenttable > tbody::before,#torrenttable > tbody::after{content:"";position:absolute;'
            + 'top:0;bottom:0;width:11px;background-image:repeating-linear-gradient(180deg,'
            + HOLE + ' 0 9px,transparent 9px 22px);}',
            '#torrenttable > tbody::before{left:0;}',
            '#torrenttable > tbody::after{right:0;}',
            // 片头: 吸顶可排序栏
            // ⚠️ 横向 padding 必须和数据行 `R` 的 `padding:7px 10px` **一致**(10px) ——
//    片头要和数据行同一条列网格, 差 1px 就是整行错位。
//    (.19 用户实拍"标题栏错位": 片头原为 `padding:10px 0 9px`(左右 0), 数据行是 `7px 10px`,
//     两侧各差 10px ⇒ 每一列的表头都比数据往左 10px, 12 列全错。真站实测 Δl=10。)
H + '{position:sticky;top:0;z-index:6;display:flex;align-items:stretch;column-gap:' + GAP
            + ';padding:10px 10px 9px;width:100%;background:var(--hdui-headbg);'
            + 'border-bottom:1px solid var(--hdui-line);font-size:10.5px;letter-spacing:.12em;'
            + 'color:var(--hdui-headfg);}',
            H + ' > td{display:block;align-self:stretch;padding:0;overflow:hidden;white-space:nowrap;}',
            H + ' > td a{display:flex;align-items:center;gap:5px;justify-content:flex-end;height:100%;'
            + 'padding:0 8px;margin:0 -8px;border-radius:7px;color:inherit;font:inherit;'
            + 'letter-spacing:inherit;transition:background .14s,color .14s;}',
            H + ' > td a:hover{color:var(--hdui-accent);background:' + rgba(FILM_ACCENT, 0.12) + ';}',
            H + ' > td a img{width:16px;height:16px;flex:0 0 16px;opacity:.95;}',
            tdSel(m, 'uploader') ? H + ' > td' + C(m, 'uploader') + ' a{justify-content:flex-start;}' : '',
            // 片头对齐: 站点 `table.torrents td.colhead{text-align:center}` 会把这三格也居中
            hRule(m, ['type', 'title', 'progress'], 'text-align:left;'),
            // 帧
            R + '{position:relative;display:flex;align-items:center;column-gap:' + GAP
            + ';width:100%;min-height:50px;padding:7px 10px;background:var(--hdui-card);'
            + 'border-bottom:1px solid var(--hdui-bg);}',
            R + ':hover{background:var(--hdui-rule);}',
            // 帧号: 打在左侧片边上(counter, 纯 CSS 不写 DOM)
            R + '::before{counter-increment:frame;content:counter(frame,decimal-leading-zero);'
            + 'position:absolute;left:-24px;top:50%;transform:translateY(-50%);width:18px;'
            + 'text-align:center;font-family:var(--hdui-font-num);font-size:9.5px;'
            + 'letter-spacing:.06em;color:var(--hdui-dim);}',
            // 置顶: 左侧金色内阴影(不占流, 不把列推开)
            R + '.sticky_top{box-shadow:inset 3px 0 0 var(--hdui-accent);}',
            R + ' > td{overflow:hidden;min-width:0;}',
            basis.join('\n'),
            // 数据行对齐: 站点 `table.torrents td.rowfollow{text-align:center}` 会把标题也居中
            tdRule(m, ['type', 'title', 'uploader'], 'text-align:left;'),
            // 类别色块: 22px 图形 + 6px 内边距 = 34px 方块, 圆角 10(原型尺寸)
            tdSel(m, 'type') + '{align-self:center;}',
            tdSel(m, 'type') + ' img{width:22px;height:22px;padding:6px;box-sizing:content-box;'
            + 'border-radius:10px;display:block;}',
            // 标题
            // ⚠️ max-width 不能省: 站点外层是 table-layout:auto, 会被内容的 max-content 撑开 ——
            //    不限的话长标题把整页撑到 1503px(原站仅 1260), 窄屏得多横向滚 240px。
            //    900 = 固定列宽和(686) + 列间距(110) + 片基左右留白(60) 的约数, 改动列宽时要同步调。
            // ⚠️ .21: 这个 max-width **必须同时给片头和数据行** —— 原来只写在数据行(`tdSel` = R),
            //    片头没有上限 ⇒ 视口窄到"上限 < 可用空间"时(1024 视口: 上限 max(240,124)=240,
            //    可用 256)片头标题 256、数据行标题 240, 后面 11 列**整体左移 16px**。
            //    宽屏(1280: 上限 380 > 可用 256)看不出来, 所以只在窄屏暴露。
            [tdSel(m, 'title'), hSel(m, 'title')].filter(Boolean).join(',')
            + '{max-width:max(240px,calc(100vw - 900px));'
            + 'font-family:var(--hdui-font-title);font-size:13.5px;line-height:1.45;}',
            // ⚠️ 省略号只加在**标题链接**上, 不加在整格:
            //    真站的标题格里还有 <br> + 6~8 个标签 + 别名 —— 整格 nowrap + overflow:hidden 会把它们裁掉。
            // ⚠️ 用 inline-block + max-width 而不是 block: block 会把促销徽章顶到下一行,
            //    白占一整行高度; 留出 52px(置顶图钉 2×14 + 徽章 16 + 边距 6)让它们跟在标题同一行。
            TN_TITLE + ' > a{display:inline-block;max-width:calc(100% - 52px);overflow:hidden;'
            + 'text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;color:var(--hdui-fg);}',
            TN_TITLE + ' > a:hover{color:var(--hdui-accent);}',
            TN_TITLE + '{text-align:left;}',
            // 数值成列: 等宽 + 右对齐, 靠字号分层级(不靠色相, 配色才不打架)
            tdRule(m, ['comments', 'alive', 'size', 'seeders', 'leechers', 'snatched', 'a', 'ave'],
                'text-align:right;font-family:var(--hdui-font-num);font-variant-numeric:tabular-nums;'),
            tdRule(m, ['comments', 'alive', 'a', 'ave'], 'font-size:11.5px;color:var(--hdui-dim);'),
            tdRule(m, ['leechers', 'snatched'], 'font-size:13px;color:var(--hdui-muted);'),
            tdSel(m, 'size') + '{font-size:12px;color:var(--hdui-muted);white-space:nowrap;}',
            tdSel(m, 'size') + ' br{display:none;}',
            // 做种: 唯一的大字锚点 + 内嵌占比条
            tdSel(m, 'seeders') + '{display:block;font-size:20px;line-height:1.1;font-weight:600;color:var(--hdui-accent);}',
            tdSel(m, 'seeders') + '::after{content:"";display:block;height:3px;margin-top:4px;margin-left:auto;'
            + 'border-radius:2px;width:calc(var(--hdui-ratio,0) * 100%);background:var(--hdui-accent);opacity:.85;}',
            tdSel(m, 'progress') + '{text-align:center;font-size:11px;color:var(--hdui-dim);}',
            tdSel(m, 'uploader') + '{font-size:11.5px;color:var(--hdui-dim);overflow:hidden;text-overflow:ellipsis;}',
            tdSel(m, 'uploader') + ' a{color:var(--hdui-dim);}',
            tdSel(m, 'uploader') + ' a:hover{color:var(--hdui-accent);}',
            // 促销徽章: 真站是 img.pro_*(36×11 雪碧图), 换成 16px 金徽章并清掉雪碧图底
            '#torrenttable img[class*="pro_"]{width:16px;height:16px;background:none;'
            + 'vertical-align:-2px;margin-left:6px;}',
            // 标签: 保留站点 23 种分类底色(信息量不丢), 只把形状改成药丸 ——
            // 站点原本是 `float:left;height:16px;padding:2px 3px;color:#fff` 的硬边小方块
            '#torrenttable span.tags{float:none;display:inline-block;height:auto;'
            + 'margin:0 4px 2px 0;padding:1px 7px;border-radius:999px;font-size:10px;'
            + 'font-weight:600;letter-spacing:.02em;line-height:1.5;vertical-align:1px;}',
            // 别名/副标题 span(站内自带, 行内 float:left) —— 不摊平它会把标签行挤歪。
            // 用 inline 而不是 block: 让它接着标签排、自然折行, 省掉一整行高度。
            TN_TITLE + ' > span:not([class]){float:none !important;display:inline;'
            + 'padding:0 !important;line-height:1.5 !important;font-size:11px;color:var(--hdui-dim);}',
            headLabels.join('\n'),
            headIcons.join('\n'),
            // ---- 标题格的内嵌表: 真站是三格, 摆成一行 flex, 不再摊平成 inline 乱流 ----
            // 旧写法 `display:block` + `td{display:inline}` 只对"标题 + RSS 两格"的原型成立;
            // 真站第二格(豆瓣/IMDb + 下载/收藏)会被拉进同一条 inline 流里。
            // ⚠️ background:transparent 不能省: 站点有一条**通配的** `table{background-color:#bccad6}`,
            //    它命中的不只是标题格那张表, 还有 meta 格里**嵌套的小表**(豆瓣/IMDb + 下载/收藏) ——
            //    不一起覆盖, 深色片基上就会冒出两块浅蓝。
            '#torrenttable table{background:transparent;}',
            '#torrenttable table.torrentname{display:block;width:100%;border-collapse:collapse;'
            + 'background:transparent;}',
            '#torrenttable table.torrentname > tbody{display:block;}',
            // 一行 flex + **允许换行**: 第一行 = 标题 + RSS(原型的排法),
            // 第二行 = 豆瓣/IMDb + 下载/收藏 整块(原型里没有这块, 给它单独一行, 免得挤掉标题)。
            // ⚠️ 标题的 flex-basis 必须是 `0` 而不是 `auto`: 折行判定用的是"假想主尺寸",
            //    basis:auto 会按长标题的 max-content 算 —— 它一个人就占满第一行, RSS 被挤下去。
            TN + '{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;width:100%;'
            + 'background:transparent;}',
            TN + ' > td{border:0;padding:0;background:transparent;min-width:0;}',
            TN_TITLE + '{flex:1 1 0;min-width:0;order:1;}',
            // 2026-09-19 .13: 用户反馈「豆瓣/IMDb/下载/收藏应在标题后面」, 旧方案
            // `flex:1 1 100%` 强制它单独占满第二行 ⇒ 现在改成 flex:0 0 auto 与标题**同行**,
            // title 仍然 flex:1 1 0 + min-width:0 让出空间(meta 按内容宽度, 标题长就缩成省略号)。
            // 顺序仍是 title(1) | RSS(2) | meta(3) —— RSS 卡在中间, meta 在最右侧, 是真站的视觉习惯。
            TN_META + '{flex:0 0 auto;width:auto;order:3;display:flex;align-items:flex-start;gap:8px;max-width:340px;}',
            // ---- 豆瓣/IMDb + 下载/收藏: 真站独有的第二格, 原型 film.html 里没有 ----
            // 真站结构: td.embedded > table > tbody > tr > [ td(div > 豆瓣<br>IMDb), td(下载<br>收藏) ]
            // ⚠️ 旧写法把 tr 摊平成 `display:flex`、又把 <br> 全隐藏 ⇒ 豆瓣/IMDb/下载/收藏 4 个链接
            //    全被塞进同一条 inline 流, 彼此只隔 6px —— 这就是「按钮挤到一起」。
            // 现在改成 **两列竖排**: 左列评分(豆瓣在上 / IMDb 在下), 右列操作(下载在上 / 收藏在下),
            // 每个链接各自成一个 chip(圆角微底 + hover 转金), 彼此不再粘连。
            TN_META + ' table{display:block;}',
            TN_META + ' tbody{display:block;}',
            TN_META + ' tr{display:flex;align-items:flex-start;gap:10px;}',
            // 两列都竖排: 评分列(内含 div)与操作列(两个裸 <a>)各占一列
            TN_META + ' td{display:flex;flex-direction:column;align-items:flex-start;gap:3px;'
            + 'border:0;padding:0;background:transparent;}',
            // 豆瓣/IMDb 那个 div 是**行内样式**(text-align:right;width:50px) —— 行内样式压过任何选择器,
            // 只能上 !important 才盖得住(这是全脚本唯一用 !important 的地方, 仅针对这一处行内样式)
            TN_META + ' div{display:flex;flex-direction:column;align-items:flex-start;gap:3px;'
            + 'width:auto !important;text-align:left !important;margin-right:0 !important;'
            + 'font-size:10px;line-height:1.5;color:var(--hdui-dim);}',
            // 竖排交给上面的 flex-direction, <br> 留着只会多撑出行距 —— 隐藏
            TN_META + ' br{display:none;}',
            // 每个动作独立成 chip: 图标 + 文字(评分或动作名), 圆角微底, hover 金底金字
            TN_META + ' a{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;'
            + 'border-radius:6px;font-size:10px;line-height:1.5;color:var(--hdui-muted);'
            + 'background:rgba(255,255,255,.045);transition:background .14s,color .14s;}',
            TN_META + ' a:hover{background:rgba(245,179,66,.14);color:var(--hdui-accent);}',
            // 图标缩到 12px(与 RSS 同档) —— 站点给的是 16px, 塞进 chip 里偏大
            TN_META + ' img{width:12px;height:12px;flex:0 0 12px;opacity:.85;}',
            TN_META + ' a:hover img{opacity:1;}',
            // RSS 格
            TN + ' > td.rss{flex:0 0 auto;padding-left:8px;width:auto;order:2;}',
            // ⚠️ line-height:0 + display:block 不能省: 否则 <a> 的盒子是**整条行盒**(含行距空白),
            //    而图片只有 12px —— 点 <a> 盒子的几何中心会落在行距里, hit-test 命中行背景而不是图片,
            //    站内 RSS 的点击处理器因此收不到事件(仿真用例 `sim-hdui-danger-guard` 抓到的就是这个)。
            TN + ' > td.rss a{display:inline-block;line-height:0;}',
            // ⚠️ filter 不能省: 站点 `a[data-toggle-rss] img{filter:grayscale(100%)}` 会把换上去的
            //    彩色 SVG 直接去色, 看起来就是一个灰图标。
            TN + ' > td.rss img{display:block;width:12px;height:12px;opacity:.55;'
            + 'filter:none;-webkit-filter:none;}',
            TN + ' > td.rss img:hover{opacity:1;}',
            // 导航药丸(结构样式在全局块, 这里只补主题专属的两条)
            'ul#mainmenu li.selected a{font-weight:600;}'
        ].filter(Boolean).join('\n');
    }

    const THEMES = Object.freeze([
        {
            id: 'film', name: '胶片墙', note: '齿孔片边 · 帧号 · 做种金', icon: 'frame',
            vars: {
                '--hdui-bg': '#100e0d', '--hdui-panel': '#191512', '--hdui-card': '#201c18',
                // 三层语义灰: fg(乳剂白) / muted(次要) / dim(弱) —— 原型是 fg/fg2/fg3 三层,
                // 生产脚本当初只搬了两层, 于是 comments/存活/A/进度/上传者/帧号 全都亮了一档。
                '--hdui-fg': '#f2ede5', '--hdui-muted': '#a79e93', '--hdui-dim': '#7a7267',
                '--hdui-accent': '#f5b342',
                '--hdui-link': '#f2ede5', '--hdui-line': '#332c26', '--hdui-rule': '#2a241f',
                '--hdui-headbg': '#191512', '--hdui-headfg': '#a79e93',
                '--hdui-zebra1': '#201c18', '--hdui-zebra2': '#23201b',
                '--hdui-font': '"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif',
                '--hdui-font-title': '"Source Han Sans CN Medium","Noto Sans SC",sans-serif',
                '--hdui-font-num': 'Bahnschrift,"DIN Alternate",Consolas,monospace',
                '--hdui-fs': '13px', '--hdui-fs-sm': '11px',
                // 导航: 纵向留白交给 #nav_block(10px 0 8px), ul 只管左右 20px。
                // navitem 用原型的 7px 11px —— 当年压成 6px 9px 是因为把"标签自带 NBSP"误判成
                // "原型间距太宽"; 现在由 `ul#mainmenu{word-spacing:-.3em}` 收掉 NBSP, 可以还原。
                // navreserve 是给内嵌入口留的槽位宽度(右侧): 不留的话入口只能掉到下一行压住信息栏。
                '--hdui-navpad': '0 20px', '--hdui-navitem': '7px 11px', '--hdui-navgap': '2px',
                '--hdui-navreserve': DOCK_RESERVE + 'px',
                '--hdui-radius': '9px'
            },
            css: filmCss
        }
    ]);

    const DEFAULT_THEME = {
        id: DEFAULT_ID, name: '原站默认', note: '不做任何改动', icon: 'dot',
        vars: {}, css: function () { return ''; }
    };

    function themeById(id) {
        if (id === DEFAULT_ID) return DEFAULT_THEME;
        for (let i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
        return null;
    }

    // ==================================================================
    // 结构与契约校验
    // ==================================================================
    function headerKey(td) {
        const txt = (td.textContent || '').trim();
        const id = td.getAttribute('id') || '';
        const img = td.querySelector('img');
        const cls = img ? (img.getAttribute('class') || '') : '';
        const title = img ? (img.getAttribute('title') || '') : '';
        const hint = txt + ' ' + title;
        if (id === 'calcTHeadA') return 'a';
        if (id === 'calcTHeadAve') return 'ave';
        if (txt === '类型') return 'type';
        if (txt === '标题') return 'title';
        if (txt === '进度') return 'progress';
        if (txt.indexOf('发布者') >= 0) return 'uploader';
        if (/\bcomments\b/.test(cls) || /评论/.test(hint)) return 'comments';
        if (/\btime\b/.test(cls) || /存活/.test(hint)) return 'alive';
        if (/\bsize\b/.test(cls) || /大小/.test(hint)) return 'size';
        if (/seeders/.test(cls) || /种子数/.test(hint)) return 'seeders';
        if (/leechers/.test(cls) || /下载数/.test(hint)) return 'leechers';
        if (/snatched/.test(cls) || /完成数/.test(hint)) return 'snatched';
        return '';
    }

/**
 * 读出表头 -> {key: 1-based 列号}。
 * missing = 缺**必需**列(判失败); absent = 缺**可选**列(A / A/GB, 只记日志, 排版时跳过)。
 * headText = {key: 该列表头**是否本来就有文字**} —— 用来决定要不要用 ::after 补栏名。
 *   真站的「发布者」列头是 `<td class="colhead"><a>发布者</a></td>`(**自带文字**),
 *   而「评论/存活/大小/做种/下载/完成」是只有 `<img>` 的格。原型当初把发布者也当成"只有图标"的格,
 *   于是脚本又补了一遍 ⇒ 真站渲染成「发布者 发布者 ↓」。这个标志位就是修这个的抓手。
 */
function detectColumns(table) {
    const body = table.tBodies && table.tBodies[0];
    if (!body) return { map: null, missing: REQUIRED_COLUMNS.slice(), absent: [], headText: {}, reason: 'TABLE_NO_TBODY' };
    const head = body.rows[0];
    if (!head) return { map: null, missing: REQUIRED_COLUMNS.slice(), absent: [], headText: {}, reason: 'TABLE_NO_HEAD' };
    const map = {};
    const headText = {};
    const cells = head.cells;
    for (let i = 0; i < cells.length; i++) {
        const key = headerKey(cells[i]);
        if (key && map[key] === undefined) {
            map[key] = i + 1;
            headText[key] = (cells[i].textContent || '').trim().length > 0;
        }
    }
    const missing = [];
    for (let i = 0; i < REQUIRED_COLUMNS.length; i++) {
        if (map[REQUIRED_COLUMNS[i]] === undefined) missing.push(REQUIRED_COLUMNS[i]);
    }
    const absent = [];
    for (let i = 0; i < OPTIONAL_COLUMNS.length; i++) {
        if (map[OPTIONAL_COLUMNS[i]] === undefined) absent.push(OPTIONAL_COLUMNS[i]);
    }
    // 数据行必须与表头列数一致, 否则说明站点改版导致错位(也可能是外部脚本补列补到一半)
    let shapeOk = true;
    if (body.rows.length > 1 && body.rows[1].cells.length !== cells.length) shapeOk = false;
    return {
        map: missing.length ? null : map,
        missing: missing,
        absent: absent,
        headText: headText,
        reason: shapeOk ? '' : 'ROW_CELL_COUNT_MISMATCH',
        headCount: cells.length
    };
}

    /**
     * 契约校验:
     *   A 级 —— 主框架 / 导航 / 信息栏, 缺任一即失败
     *   B 级 —— 种子表存在时, 12 列必须全部识别出来(否则拒绝上妆, 防列错位)
     */
    function validateContract() {
        const missingAnchors = [];
        for (let i = 0; i < ANCHORS.length; i++) {
            if (!document.querySelector(ANCHORS[i].sel)) missingAnchors.push(ANCHORS[i].label);
        }
        if (missingAnchors.length) {
            return { ok: false, code: 'E_ANCHOR_MISSING', detail: '缺少: ' + missingAnchors.join(' / '), colMap: null, headText: {} };
        }
        const table = document.getElementById('torrenttable');
        if (!table) return { ok: true, code: 'OK_NO_TABLE', detail: '本页无种子表, 只应用全局样式', colMap: null, headText: {} };

        const d = detectColumns(table);
        const shapeMsg = '种子表数据行列数与表头不一致(表头 ' + d.headCount + ' 列)';
        // 必需列识别不全 -> 拒绝上妆(列一旦错位, 主题会把数据摆到错误的槽位)
        if (!d.map) {
            const detail = d.reason === 'ROW_CELL_COUNT_MISMATCH'
                ? shapeMsg
                : '种子表缺少可识别的列: ' + d.missing.join(',');
            return { ok: false, code: d.reason || 'E_COLUMN_UNKNOWN', detail: detail, colMap: null, headText: {} };
        }
        // 列都在、但数据行单元格数与表头对不上 -> 改版信号(或外部脚本补列补到一半), 一样拒绝
        if (d.reason) {
            return { ok: false, code: d.reason, detail: shapeMsg, colMap: null, headText: {} };
        }
        // 可选列缺席不报错, 只是这两列不排版 —— 补进来后由结构守卫重摆
        if (d.absent.length) {
            return { ok: true, code: 'OK_NO_CALC', detail: '外部脚本的 ' + d.absent.join('/') + ' 列未注入, 已跳过', colMap: d.map, absent: d.absent, headText: d.headText };
        }
        return { ok: true, code: 'OK', detail: '', colMap: d.map, absent: [], headText: d.headText };
    }

    // ==================================================================
    // 样式装配 / 卸载(唯一的 DOM 写入: <style> + html data 属性 + 自定义属性)
    // ==================================================================
    let paintedRows = [];

    function catColor(row, typeIdx) {
        const cell = typeIdx ? row.cells[typeIdx - 1] : null;
        const img = cell ? cell.querySelector('img') : null;
        const cls = img ? (img.getAttribute('class') || '') : '';
        for (let i = 0; i < CAT_COLORS.length; i++) {
            if (cls.indexOf(CAT_COLORS[i][0]) === 0) return CAT_COLORS[i][1];
        }
        return CAT_FALLBACK;
    }

    function numOf(row, idx) {
        if (!idx) return 0;
        const cell = row.cells[idx - 1];
        if (!cell) return 0;
        const v = parseInt((cell.textContent || '').replace(/[^\d-]/g, ''), 10);
        return isNaN(v) ? 0 : v;
    }

    /** 给已校验的行写入 --hdui-cat / --hdui-ratio(纯自定义属性, 不动结构、不动事件) */
    function paintRows(colMap) {
        const table = document.getElementById('torrenttable');
        if (!table || !colMap) return;
        const body = table.tBodies && table.tBodies[0];
        if (!body) return;
        for (let i = 1; i < body.rows.length; i++) {
            const row = body.rows[i];
            const seed = numOf(row, colMap.seeders);
            const leech = numOf(row, colMap.leechers);
            const ratio = (seed + leech) > 0 ? (seed / (seed + leech)) : 0;
            row.style.setProperty('--hdui-cat', catColor(row, colMap.type));
            row.style.setProperty('--hdui-ratio', ratio.toFixed(3));
            paintedRows.push(row);
        }
    }

    function clearPaint() {
        for (let i = 0; i < paintedRows.length; i++) {
            paintedRows[i].style.removeProperty('--hdui-cat');
            paintedRows[i].style.removeProperty('--hdui-ratio');
        }
        paintedRows = [];
    }

    function buildCss(theme, colMap, headText) {
        const vars = [];
        for (const k in theme.vars) {
            if (Object.prototype.hasOwnProperty.call(theme.vars, k)) vars.push(k + ':' + theme.vars[k] + ';');
        }
        let out = 'html[data-hdui-theme="' + theme.id + '"]{' + vars.join('') + '}\n';
        out += [
            // ⚠️ html 也要铺: 只给 body 上色的话, 短页面(内容不足一屏)在 body 之下仍露出 <html> 的白。
            //    这也是 document-start 那条 `html{background}` 在 unload 后失效留下的缝。
            'html[data-hdui-theme]{background:var(--hdui-bg);}',
            'html[data-hdui-theme] body{background:var(--hdui-bg);color:var(--hdui-fg);font-family:var(--hdui-font);font-size:var(--hdui-fs);}',
            'html[data-hdui-theme] table.mainouter,html[data-hdui-theme] table.main{background:var(--hdui-panel);border-color:var(--hdui-line);}',
            // ---- 大面积白底的真因 ----
            // 真站 `table{background-color:#bccad6}` 是 **(0,0,1) 通配**, 而原先脚本只覆盖了
            // `table.mainouter` / `table.main` —— 种子表**之外**的任何表格(我的 / 论坛 / 搜索框 /
            // 详情页)全在漏这块浅蓝灰, 视觉上就是"一整片白"。body 其实早就被盖住了。
            // ⚠️ 不必担心伤到片基: `#torrenttable table{background:transparent}`(1,1,2) 特异性更高,
            //    种子表内的内嵌表仍然是 transparent。
            'html[data-hdui-theme] table{background:var(--hdui-panel);}',
            // 表外那些近白的格子: rowfollow #f4f4f9 / colhead #2f4879 / text / comment。
            // 特异性 (0,2,1) < `#torrenttable td`(1,1,2) ⇒ 种子表内照旧 transparent, 不破坏片基。
            'html[data-hdui-theme] td.rowfollow,html[data-hdui-theme] td.colhead,'
            + 'html[data-hdui-theme] td.text,html[data-hdui-theme] td.comment{background:var(--hdui-panel);}',
            // 站点那些亮黄警示块(顶部通知条等)多是 HTML 属性 bgcolor 或行内 style, 普通选择器压不过。
            // 连同其它 bgcolor 一起压深, 免得一片 #ffffcc / #ffffff 糊在最上面。
            'html[data-hdui-theme] table[bgcolor],html[data-hdui-theme] td[bgcolor],'
            + 'html[data-hdui-theme] tr[bgcolor]{background:var(--hdui-panel) !important;}',
            // ---- .14 兜底(用户实拍「首页/论坛等标签仍是白色」): 非种子页上常见浅色容器 ----
            // 站点用 inline style 画白底时普通选择器压不过, 用属性选择器子串匹配 + !important。
            // 列出所有常见的白/浅写法(大小写/空格/三种 hex 三种 rgb 都要兜), 仍然兜不住的就只能靠用户截图。
            'html[data-hdui-theme] [style*="background-color: rgb(255, 255, 255)"],'
            + 'html[data-hdui-theme] [style*="background-color:rgb(255,255,255)"],'
            + 'html[data-hdui-theme] [style*="background-color: white"],'
            + 'html[data-hdui-theme] [style*="background-color:white"],'
            + 'html[data-hdui-theme] [style*="background-color: #fff"],'
            + 'html[data-hdui-theme] [style*="background-color:#fff"],'
            + 'html[data-hdui-theme] [style*="background-color: #FFF"],'
            + 'html[data-hdui-theme] [style*="background-color:#FFF"],'
            + 'html[data-hdui-theme] [style*="background: rgb(255, 255, 255)"],'
            + 'html[data-hdui-theme] [style*="background: #fff"],'
            + 'html[data-hdui-theme] [style*="background:#fff"]{background:var(--hdui-panel) !important;}',
            // 常见 NexusPHP 容器类: toolbar(顶部工具条) / navigation(分页) 等仍是浅色
            'html[data-hdui-theme] td.toolbar,html[data-hdui-theme] td.navigation{background:var(--hdui-panel);}',
            // 分页页码 + 当前页高亮: 站点是 `p[align=center] a / b`, 已设了 fg/muted/accent,
            // 但 .b 经常被嵌套在 <a> 里只继承父色, 当前页用 `b` 也得单独给 fg(否则 `<b>` 默认更深反而看不清)
            'html[data-hdui-theme] p[align="center"] b{color:var(--hdui-fg);}',
            'html[data-hdui-theme] td.embedded,html[data-hdui-theme] td.outer,html[data-hdui-theme] td.bottom{background:transparent;}',
            'html[data-hdui-theme] a{color:var(--hdui-link);text-decoration:none;}',
            'html[data-hdui-theme] a:hover{color:var(--hdui-accent);}',
            // ---- .16 站点 `<font color>` 老式着色: 深色底上的深色字 = 看不见 ----
            // 真站对比度扫描抓到两类: ① 底栏 `.color_*` 统计值一律 #1900d1(深蓝, 与片基亮度差 9);
            // ② 数据行里的红色标记(#dd0000 ~ #550000, 最暗那条差只有 3)。
            // ⚠️ CSS 拿不到"站点原本那个色"(`currentColor` 是继承值不是自身指定值), 只能**按值枚举** ——
            //    所以下面两张表必须覆盖真站实际出现过的写法; 新发现的暗色补进来即可。
            // 配色纪律: 统计值各给一个可辨的色位(复用现有色板), 红色标记统一提亮成可读的红。
            FONT_DARK_RED.map(function (hex) {
                return 'html[data-hdui-theme] font[color="' + hex + '"]';
            }).join(',') + '{color:#e5705f;}',
            // ⚠️ 必须**一条一色**分开写: 把 7 个选择器并成一条、声明块里连写 7 个 color,
            //    只有最后一个生效(前面的被覆盖), 7 个统计值会变成同一个色。
            INFO_COLORS.map(function (x) {
                return 'html[data-hdui-theme] font.' + x[0] + '{color:' + x[1] + ';}';
            }).join(''),
            // ---- 导航区 + 信息栏(原型 navCss) ----
            // position:relative 给"入口内嵌"兜底用(入口本身挂在 body 上, 不受影响)
            'html[data-hdui-theme] #nav_block{position:relative;background:var(--hdui-panel);'
            + 'padding:10px 0 8px;border-bottom:1px solid var(--hdui-line);}',
            // ⚠️ box-sizing 不能省: 真站的 `#info_block` 是 `<table width="100%">`,
            //    content-box 下再加 40px 左右内边距 = 把容器顶宽 40px(实测文档宽 1247 → 1250),
            //    窄屏就得多横向滚。原型里它是 <div>, 所以当初没暴露这个问题。
            'html[data-hdui-theme] #info_block{padding:6px 20px 10px;box-sizing:border-box;'
            + 'font-size:11.5px;color:var(--hdui-dim);}',
            'html[data-hdui-theme] #info_block b{color:var(--hdui-muted);font-weight:600;}',
            'html[data-hdui-theme] #info_block a{color:var(--hdui-link);}',
            // ⚠️ 这三条不能省: 全局 `a:hover`(0,2,2) 会被上面那些 `#info_block a`(1,1,3) 压死,
            //    悬停就完全没有反馈了 —— 特异性碰撞不会报错, 只会静默失效。
            'html[data-hdui-theme] #info_block a:hover{color:var(--hdui-accent);}',
            'html[data-hdui-theme] #footer{color:var(--hdui-dim);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] #footer a{color:var(--hdui-link);}',
            'html[data-hdui-theme] #footer a:hover{color:var(--hdui-accent);}',
            // 导航: flex + 显式列间距 —— 旧的 inline-block 紧挨排列会把 16 个入口挤成一坨
            // max-width:100vw 不能省: 站点外层是固定宽布局(文档宽 ~1260), 导航条会跟着拿到 1248px;
            // flex 单行排下去, 窄屏(<1248)时后面的入口就排到视口外点不到了。
            // 原站是 inline 布局会自然换行, 换成 flex 后必须显式给上限才会 wrap。
            // word-spacing 不能省: 真站标签自带 `&nbsp;` 内边距(`&nbsp;首&nbsp;&nbsp;页&nbsp;`),
            // 4 个 NBSP 把每项撑宽 ~12px, 16 项就是 ~190px —— 这才是"16 项塞不进 1262px"的真正原因
            // (当年误判成原型 navitem 太宽, 于是把 7px 11px 压成 6px 9px 绕过)。
            // word-spacing 作用于词分隔符(含 U+00A0), 收掉它就能既保住原型间距、又不挤爆导航条。
            'html[data-hdui-theme] ul#mainmenu{display:flex;flex-wrap:wrap;align-items:center;'
            + 'row-gap:2px;column-gap:var(--hdui-navgap);margin:0;padding:var(--hdui-navpad);'
            + 'padding-right:calc(20px + var(--hdui-navreserve));'
            + 'background:var(--hdui-panel);list-style:none;max-width:100vw;box-sizing:border-box;'
            + 'word-spacing:-.3em;}',
            'html[data-hdui-theme] ul#mainmenu li{display:block;}',
            // border:0 必须: 站点给 `ul.menu li a` 画了 1px 白边 + #dedede 底
            // ⚠️ background:transparent 也不能省(.15): 只清 border 不清底, 导航项就是一排
            //    #dedede 白标签 —— 用户实拍的"首页/论坛等标签仍是白色"正是这条。
            //    原型 film.html 里导航项**默认无底**(只有 hover 的 rgba(255,255,255,.055)),
            //    所以这里必须显式压成 transparent, 不能指望继承。
            'html[data-hdui-theme] ul#mainmenu li a{display:block;padding:var(--hdui-navitem);border:0;'
            + 'background:transparent;border-radius:var(--hdui-radius);color:var(--hdui-muted);'
            + 'font-size:12.5px;font-weight:500;'
            + 'white-space:nowrap;transition:background .14s,color .14s;}',
            'html[data-hdui-theme] ul#mainmenu li a:hover{background:rgba(255,255,255,.055);color:var(--hdui-fg);}',
            // 末 6 项弱化一档(原型用字号 + 灰度压下去)。
            // `:not(.selected)` 不能省: 否则停在 /rules.php 这类页面时, 选中项会被压成灰字压在金底上。
            'html[data-hdui-theme] ul#mainmenu li:nth-child(n+11):not(.selected) a{font-size:11.5px;color:var(--hdui-dim);}',
            'html[data-hdui-theme] ul#mainmenu li.selected a{background:var(--hdui-accent);color:#17130e;}',
            // ---- .22 进度指示器的状态色 ----
            // 站点原来靠**底色**区分做种(青 #44cef6) / 下载(粉 #CC0066), 但 `[bgcolor]` 被压成
            // 统一的 panel 之后, 两种状态长得一模一样 —— 只剩文字能分辨。
            // 这里按 `translateLeeching()` 打的 `data-hdui-prog` 标记把**文字**染回语义色补回线索。
            // ⚠️ 必须连 `font` 一起选: 站点在 `<font color="#fff">` / `<font color="#FF0066">` 上
            //    写了自己的 color, 只染 `td` 会被子元素的声明盖掉。
            'html[data-hdui-theme] #torrenttable td[data-hdui-prog="seed"],'
            + 'html[data-hdui-theme] #torrenttable td[data-hdui-prog="seed"] font,'
            + 'html[data-hdui-theme] #torrenttable td[data-hdui-prog="seed"] b{color:#7fb84e;}',
            'html[data-hdui-theme] #torrenttable td[data-hdui-prog="leech"],'
            + 'html[data-hdui-theme] #torrenttable td[data-hdui-prog="leech"] font,'
            + 'html[data-hdui-theme] #torrenttable td[data-hdui-prog="leech"] b{color:#f5b342;}',
            // ---- .23 DomTT 提示框 / 表情面板(站点遗留的浅蓝灰块) ----
            // 站点 `div.niceTitle{background-color:#7c98ae;color:#000}` —— 这是 hover 提示框,
            // 平时 `visibility:hidden` 所以**漏白扫描抓不到**(但它一 hover 就在深色底上亮一块)。
            // `div.smilies td` 是论坛的表情选择器, 同一个色。
            // ⚠️ 这类"隐藏时才存在"的元素要**主动按选择器查**, 不能只靠渲染扫描 ——
            //    扫描看的是"此刻可见", 而 hover 态的元素此刻恰恰不可见。
            'html[data-hdui-theme] div.niceTitle{background:var(--hdui-panel) !important;'
            + 'color:var(--hdui-fg) !important;border:1px solid var(--hdui-line);'
            + 'border-radius:0 10px 10px 10px;padding:4px;font-size:12.5px;}',
            'html[data-hdui-theme] div.smilies td{background:var(--hdui-panel) !important;'
            + 'color:var(--hdui-fg) !important;border-color:var(--hdui-line);}',
            'html[data-hdui-theme] table.searchbox{background:var(--hdui-panel);color:var(--hdui-fg);border:1px solid var(--hdui-line);}',
            'html[data-hdui-theme] table.searchbox td.colhead{background:var(--hdui-panel);color:var(--hdui-fg);}',
            'html[data-hdui-theme] table.searchbox td.rowfollow{background:transparent;border-color:var(--hdui-line);}',
            // ---- 表单元素(深色化): 搜索框 / 下拉框 / 按钮 ----
            // 站点默认 `input[type=text]` / `select` 是白色背景 + 黑字(白底在深色片基上刺眼),
            // `input.btn` 是浅蓝底白字(没跟着主题变深) —— 用户实拍截图反馈「给我搜按钮仍是白色」。
            // 一律改成深色底 + 金边 hover, 沿用导航栏的圆角变量保持风格统一。
            'html[data-hdui-theme] input[type=text],html[data-hdui-theme] select,'
            + 'html[data-hdui-theme] textarea{background:var(--hdui-bg);color:var(--hdui-fg);'
            + 'border:1px solid var(--hdui-line);padding:5px 8px;border-radius:6px;'
            + 'font-family:var(--hdui-font);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] input[type=text]:focus,html[data-hdui-theme] select:focus,'
            + 'html[data-hdui-theme] textarea:focus{border-color:var(--hdui-accent);outline:0;}',
            // radio / checkbox: 直接走 accent-color 跟主题金 —— 不画新的光影
            'html[data-hdui-theme] input[type=radio],html[data-hdui-theme] input[type=checkbox]{accent-color:var(--hdui-accent);}',
            // 按钮(站内是 .btn 类 + input[type=button/submit] + button[type=submit]): 默认深色 + 金边,
            // hover 转金底深字 —— 与导航药丸一致的「默认克制、悬停强调」原则
            'html[data-hdui-theme] input.btn,html[data-hdui-theme] input[type=button],'
            + 'html[data-hdui-theme] input[type=submit],html[data-hdui-theme] button[type=submit]{'
            + 'background:var(--hdui-panel);color:var(--hdui-fg);border:1px solid var(--hdui-line);'
            + 'padding:4px 14px;border-radius:var(--hdui-radius);cursor:pointer;'
            + 'font:600 12px/1.4 var(--hdui-font);transition:background .14s,border-color .14s,color .14s;}',
            'html[data-hdui-theme] input.btn:hover,html[data-hdui-theme] input[type=button]:hover,'
            + 'html[data-hdui-theme] input[type=submit]:hover,html[data-hdui-theme] button[type=submit]:hover{'
            + 'background:var(--hdui-accent);color:#17130e;border-color:var(--hdui-accent);}',
            // ---- .17 UA 渲染的界面(不是元素, 扫描扫不到, 却最容易在真站上暴露) ----
            // ① password / number / email 等输入框: 上面那条只写了 type=text, 登录页的密码框会漏成白底。
            'html[data-hdui-theme] input[type=password],html[data-hdui-theme] input[type=number],'
            + 'html[data-hdui-theme] input[type=email],html[data-hdui-theme] input[type=url],'
            + 'html[data-hdui-theme] input[type=search],html[data-hdui-theme] input[type=tel]'
            + '{background:var(--hdui-bg);color:var(--hdui-fg);border:1px solid var(--hdui-line);'
            + 'padding:5px 8px;border-radius:6px;font-family:var(--hdui-font);font-size:var(--hdui-fs-sm);}',
            // ② color-scheme: 让浏览器自己把滚动条 / 下拉弹层 / 日期选择这些**非元素**的界面也画成深色。
            //    ⚠️ 这一条不是可选项: 上面所有 CSS 都只作用于 DOM 元素, 滚动条和 <select> 的弹出列表
            //    是 UA 画的, 不设 color-scheme 就永远是浅色 —— 而它们根本不在"漏白扫描"的视野里。
            'html[data-hdui-theme]{color-scheme:dark;}',
            // ⚠️ **不要再自己写 `::-webkit-scrollbar{width:...}` 去改滚动条宽度** —— 实测踩过:
            //    把默认的 15px 压成 10px, 内容区就宽 5px, 站点那套固定宽布局跟着长 5px,
            //    文档宽 1247 → 1252, 「不撑宽页面」(`sim-hdui-layout-width`)直接红。
            //    而且任何 `::-webkit-scrollbar-*` 规则都会让 Chrome 从 overlay 切回 classic 滚动条,
            //    同样是几何改动。着色交给 `color-scheme:dark`(浏览器自己画深色滚动条), 几何零改动。
            // ③ 自动填充: Chrome 会给填过的输入框强行刷成浅黄底 + 深色字, 且**优先级高于普通声明**,
            //    只能用 inset box-shadow 把背景盖掉(-webkit-autofill 改不了 background-color)。
            'html[data-hdui-theme] input:-webkit-autofill,'
            + 'html[data-hdui-theme] input:-webkit-autofill:hover,'
            + 'html[data-hdui-theme] input:-webkit-autofill:focus,'
            + 'html[data-hdui-theme] textarea:-webkit-autofill,'
            + 'html[data-hdui-theme] select:-webkit-autofill{'
            + '-webkit-text-fill-color:var(--hdui-fg);caret-color:var(--hdui-fg);'
            + '-webkit-box-shadow:0 0 0 1000px var(--hdui-bg) inset;'
            + 'border:1px solid var(--hdui-line);transition:background-color 9999s ease-out 0s;}',
            // ④ 选中文字 / placeholder / 焦点环: 都是"用的时候才发现"的细节, 深色底上默认都很难看
            'html[data-hdui-theme] ::selection{background:rgba(245,179,66,.28);color:var(--hdui-fg);}',
            'html[data-hdui-theme] input::placeholder,html[data-hdui-theme] textarea::placeholder'
            + '{color:var(--hdui-dim);opacity:1;}',
            'html[data-hdui-theme] input:focus-visible,html[data-hdui-theme] select:focus-visible,'
            + 'html[data-hdui-theme] textarea:focus-visible,html[data-hdui-theme] button:focus-visible{'
            + 'outline:2px solid var(--hdui-accent);outline-offset:1px;}',
            'html[data-hdui-theme] p[align="center"]{color:var(--hdui-muted);font-size:var(--hdui-fs-sm);}',
            'html[data-hdui-theme] p[align="center"] a{color:var(--hdui-link);}',
            'html[data-hdui-theme] p[align="center"] a:hover{color:var(--hdui-accent);}',
            'html[data-hdui-theme] #torrenttable{width:100%;border-collapse:collapse;background:transparent;}',
            // 把站点的 td 默认边框/底色/内边距全抹掉, 防止 card/grid 里漏出浅色格线
            'html[data-hdui-theme] table.torrents td,html[data-hdui-theme] #torrenttable td{border:0;padding:0;background:transparent;vertical-align:middle;}',
            // ⚠️ 列头这两条不能省: 站点 `td.colhead{color:#ffffff;font-weight:bold}` 是**格子自己的**声明,
            //    会压过从 <tr> 继承来的颜色/字重 —— 不重置的话列头就是纯白粗体, 与原型(fg2 + 常规)不符。
            //    `#torrenttable td.colhead`(1,1,1) 压得住 `td.colhead`(0,1,1)。
            'html[data-hdui-theme] #torrenttable td.colhead{color:inherit;font-weight:inherit;'
            + 'font-family:inherit;font-size:inherit;letter-spacing:inherit;text-transform:inherit;}',
            'html[data-hdui-theme] #torrenttable td.colhead a{color:inherit;}',
            'html[data-hdui-theme] #torrenttable img{max-width:100%;}'
        ].join('\n');
        // 图标替换(类别 / 促销 / 表头指标 / RSS)—— 所有主题通用, 且放在主题 CSS 之前,
        // 让主题能用更高特异性的选择器覆盖尺寸
        out += '\n' + iconCss();
        if (theme.navIcons !== false) out += '\n' + navIconCss();
        if (colMap) out += '\n' + theme.css(colMap, headText);
        return out;
    }

    function injectCss(id, text) {
        const old = document.getElementById(id);
        if (old && old.parentNode) old.parentNode.removeChild(old);
        const st = document.createElement('style');
        st.setAttribute('id', id);
        st.setAttribute('data-hdui', 'css');
        st.textContent = text;
        const target = document.head || document.documentElement;
        target.appendChild(st);
        return st;
    }

    function unload() {
        // 回退/换妆时先停掉结构守卫, 否则 MutationObserver 会在默认界面上空转
        stopWatch();
        clearPaint();
        const css = document.getElementById(STYLE_ID);
        if (css && css.parentNode) css.parentNode.removeChild(css);
        const boot = document.getElementById(BOOT_ID);
        if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
        delete document.documentElement.dataset.hduiTheme;
        delete document.documentElement.dataset.hduiState;
    }

    // ==================================================================
    // 可见提示: 结构错误必须让用户看见, 不许静默
    // ==================================================================
    function showAlert(code, detail) {
        if (!document.body) return null;
        let box = document.getElementById(ALERT_ID);
        if (!box) {
            box = document.createElement('div');
            box.setAttribute('id', ALERT_ID);
            box.setAttribute('role', 'alert');
            box.setAttribute('data-hdui', 'alert');
            box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483001;'
                + 'background:#7a1f1a;color:#fff;padding:10px 16px;font:13px/1.5 "Microsoft YaHei",sans-serif;'
                + 'box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
            document.body.appendChild(box);
        }
        while (box.firstChild) box.removeChild(box.firstChild);

        // 配置类(存储值失效) ≠ 结构类(页面长得不对): 措辞要分开, 否则把人往"页面坏了"上引
        const isCfg = CONFIG_CODES.indexOf(code) >= 0;

        const txt = document.createElement('span');
        txt.setAttribute('data-hdui', 'alert-text');
        txt.textContent = '[' + ScriptName + '] ' + (isCfg ? '主题设置无效' : '页面结构与预期不符')
            + '(' + code + '), 已恢复站点默认界面。' + (detail ? ' ' + detail : '');
        box.appendChild(txt);

        const retry = document.createElement('button');
        retry.setAttribute('type', 'button');
        retry.setAttribute('data-hdui', 'alert-retry');
        retry.style.cssText = 'background:#fff;color:#7a1f1a;border:0;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:12px;';
        if (isCfg) {
            // 重试是没用的(值还是那个值) —— 直接给一条能走通的路
            retry.textContent = '改用胶片墙';
            retry.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dismissAlert();
                storeSet(STORE_THEME, LEGACY_MIGRATE_TO);
                applyTheme(LEGACY_MIGRATE_TO);
            });
        } else {
            retry.textContent = '重新尝试';
            retry.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                dismissAlert();
                applyStored(true);
            });
        }
        box.appendChild(retry);

        const close = document.createElement('button');
        close.setAttribute('type', 'button');
        close.setAttribute('data-hdui', 'alert-close');
        close.textContent = '知道了';
        close.style.cssText = 'background:transparent;color:#fff;border:1px solid #fff;border-radius:3px;padding:3px 10px;cursor:pointer;font-size:12px;';
        close.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            dismissAlert();
        });
        box.appendChild(close);
        return box;
    }

    function dismissAlert() {
        const box = document.getElementById(ALERT_ID);
        if (box && box.parentNode) box.parentNode.removeChild(box);
    }

    // ==================================================================
    // 选择 / 记忆
    // ==================================================================
    let currentId = DEFAULT_ID;
    let observer = null;
    let watchTimer = 0;
    let appliedSig = null;   // 上次成功上妆时的列签名(用来发现外部脚本加/删了列)
    let appliedAbsent = [];  // 上次上妆时缺席的可选列(面板里显示, 便于排查时序)

    /**
     * 列签名: 列号映射 + 「哪些列头本来就有文字」。
     * 后者也要算进去 —— 它决定 ::after 要不要补栏名, 变了就得重摆一次(否则会留下重复/缺失的栏名)。
     */
    function colMapSig(map, headText) {
        if (!map) return '-';
        const cols = Object.keys(map).sort().map(function (k) { return k + map[k]; }).join(',');
        const txt = Object.keys(headText || {}).sort()
            .filter(function (k) { return headText[k]; }).join('+');
        return cols + '|' + txt;
    }

    // ==================================================================
    // 「等结构就绪」窗口
    // ------------------------------------------------------------------
    // A / A/GB 是别的脚本注入的, 它什么时候跑完我们说了不算。以前只要在那个瞬间
    // 少一列就立刻弹红横幅回退 —— 用户看到的正是「点一下重试就好了」。现在改成:
    // 结构类失败先进窗口等, 结构一变就重试; 窗口内恢复就静默上妆, 超时才真回退。
    // ==================================================================
    let pendingTimer = 0;
    let pendingUntil = 0;
    let pendingTries = 0;
    let pendingNote = '';

    function stopPending() {
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; }
        pendingUntil = 0;
        pendingTries = 0;
        pendingNote = '';
        appliedSig = null;
    }

    /**
     * 翻译"下载中"指示器(.19 用户反馈: "Leeching" 截断, 改为中文)。
     *
     * 真站结构: `<td bgcolor="#CC0066" align="center"><font color="#fff"><b>{p}% <br> Leeching </b></font></td>`
     * —— "Leeching" 在深色片基上**和"<font color=#CC0066>"那种紫红底撞色**, 字也截断。
     *
     * ⚠️ 这是脚本里**唯一一处直接改站内文本**的逻辑。CSS 做不到换文字(只能换样式);
     *    真要纯 CSS 只能整段 `<b>` 隐藏再用 `::before` 替换, 但那会把百分比也一起吞掉。
     *    这里**只动叶子 text 节点里的 "Leeching" 单词**, 不改 DOM 结构、不挂事件、不动样式属性;
     *    只在 theme-on 时调一次, theme-off 不回退(用户在 default 态看到中文也比截断好)。
     *    若将来要严格还原, 只需在 unload() 里把这句改回去。
     */
    function translateLeeching() {
        try {
            // ⚠️ 进度指示器有**两种**, 颜色也不同, 只抓 `font[color="#fff"]` 会漏掉做种那种:
            //   做种: <td bgcolor="#44cef6"><font color="#FF0066"><b>100% <br> Seeding </b></font></td>
            //   下载: <td bgcolor="#CC0066"><font color="#fff"><b>0%   <br> Leeching </b></font></td>
            // 共同点: 都是 `td[bgcolor]` 里的 `<b>`。按这个选, 两种都覆盖。
            //
            // ⚠️ .22 补: 站点原本是**用底色区分**做种(青)/下载(粉)的, 但 .14 的
            //    `td[bgcolor]{background:var(--hdui-panel)}` 把两者压成了同一个深色 ⇒
            //    **状态的颜色线索丢了**(只剩文字)。这里顺便给格子打 `data-hdui-prog` 标记,
            //    让 CSS 能把文字染回语义色(做种=绿 / 下载=琥珀), 把线索补回来。
            //    用标记而不是 `td[bgcolor="#44cef6"]` 是因为**认词语比认站点配色稳**
            //    (站点改配色不会连带弄坏这个)。
            const bs = document.querySelectorAll('#torrenttable td[bgcolor] b');
            let n = 0;
            for (let i = 0; i < bs.length; i++) {
                // 结构是 `<b>{pct}% <br> {word} </b>` —— 单词是**第二个** text 节点,
                // 用 firstChild 会拿到 "{pct}% " 那段而漏掉。遍历所有子节点。
                for (let t = bs[i].firstChild; t; t = t.nextSibling) {
                    if (t.nodeType !== 3) continue;
                    const before = t.nodeValue;
                    if (!/\b(Leeching|Seeding)\b/.test(before)) continue;
                    t.nodeValue = before
                        .replace(/\bLeeching\b/g, '下载中')
                        .replace(/\bSeeding\b/g, '做种中');
                    // 打状态标记(认**原词**, 别认已替换后的中文 —— 重复调用时会认不出来)
                    const td = bs[i].parentNode && bs[i].parentNode.closest
                        ? bs[i].closest('td[bgcolor]') : null;
                    if (td) {
                        td.setAttribute('data-hdui-prog',
                            /\bSeeding\b/.test(before) ? 'seed' : 'leech');
                    }
                    n++;
                }
            }
            return n;
        } catch (e) {
            Diag.warn('TRANSLATE_LEECHING', '替换 Leeching/Seeding 时异常: ' + (e && e.message));
            return -1;
        }
    }

    function armPending(note, windowMs) {
        if (pendingUntil) return; // 已在窗口内: 不续期, 免得外部脚本每动一下都往后延
        pendingUntil = Date.now() + windowMs;
        pendingTries = 0;
        pendingNote = note;
        // 等窗口期间给出可观测状态: 此刻既没上妆也没回退, 只是在等那个脚本把列补完。
        // 已经在妆上的(运行中补列补到一半)保留当前主题, 不卸 —— 否则 4s 窗口里会闪一下原站界面;
        // 首装/刷新那次 unload() 已经把主题属性删了, 这里补回 default, 免得属性缺失。
        if (!document.documentElement.dataset.hduiTheme) {
            document.documentElement.dataset.hduiTheme = DEFAULT_ID;
        }
        document.documentElement.dataset.hduiState = 'pending';
        Diag.info('STRUCT_PENDING', '结构尚未就绪(' + note + '), 等外部脚本补齐, 最多 '
            + Math.round(windowMs / 1000) + 's');
        watchStructure();
        tickPending();
    }

    function tickPending() {
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = setTimeout(function () {
            pendingTimer = 0;
            try {
                if (!pendingUntil) return;
                pendingTries++;
                if (Date.now() >= pendingUntil || pendingTries > PENDING_MAX_TRIES) {
                    const note = pendingNote;
                    stopPending();
                    stopWatch();
                    Diag.error('E_STRUCT_TIMEOUT', '等待结构就绪超时: ' + note);
                    fallbackToDefault('E_STRUCT_TIMEOUT', '等待外部脚本补齐种子表结构超时(' + note + ')');
                    return;
                }
                // 到点主动试一次: 外部脚本可能已经补完但没有再触发 mutation
                const id = storeGet(STORE_THEME, FIRST_ID);
                if (id !== DEFAULT_ID) applyTheme(id);
                if (pendingUntil) tickPending();
            } catch (e) { Diag.fail('E_PENDING_FAILED', e); }
        }, PENDING_TICK_MS);
    }

    function storeGet(key, def) {
        if (typeof GM_getValue !== 'function') return def;
        const v = GM_getValue(key, undefined);
        return v === undefined || v === null ? def : v;
    }

    function storeSet(key, value) {
        if (typeof GM_setValue !== 'function') return;
        GM_setValue(key, value);
    }

    function fallbackToDefault(code, detail) {
        stopPending();
        unload();
        document.documentElement.dataset.hduiTheme = DEFAULT_ID;
        document.documentElement.dataset.hduiState = 'fallback';
        storeSet(STORE_ERR, { code: code, detail: detail, at: Date.now() });
        showAlert(code, detail);
        renderPanel();
    }

    /** 应用主题。结构类失败先进「等结构就绪」窗口, 不再立刻弹横幅 */
    function applyTheme(id, silentRetry) {
        let theme = themeById(id);
        if (!theme && LEGACY_THEMES.indexOf(id) >= 0) {
            // 旧主题已移除: 静默迁到胶片墙并写回存储。
            // 不弹横幅 —— 用户没做错任何事, 是我们把主题删了。
            Diag.info('THEME_MIGRATED', '旧主题 ' + id + ' 已移除, 改用「' + LEGACY_MIGRATE_TO + '」');
            storeSet(STORE_THEME, LEGACY_MIGRATE_TO);
            id = LEGACY_MIGRATE_TO;
            theme = themeById(id);
        }
        if (!theme) {
            Diag.warn('BAD_THEME', '存储里的主题值无效: ' + id + ', 回落默认');
            fallbackToDefault('E_BAD_THEME', '存储里的主题值「' + id + '」已不存在');
            return false;
        }
        if (theme.id === DEFAULT_ID) stopPending();
        unload();
        dismissAlert();
        if (theme.id === DEFAULT_ID) {
            currentId = DEFAULT_ID;
            document.documentElement.dataset.hduiTheme = DEFAULT_ID;
            document.documentElement.dataset.hduiState = 'off';
            Diag.info('THEME_OFF', '已恢复原站默认界面');
            syncUiVars();
            dockUi();
            renderPanel();
            return true;
        }

        const v = validateContract();
        if (!v.ok) {
            Diag.error(v.code, v.detail);
            currentId = DEFAULT_ID;
            // 结构类失败: 先把「那个脚本还没把 A / A·GB 补进来」当第一嫌疑, 等一个窗口。
            // 以前这里直接弹横幅 —— 用户点重试就好了, 纯粹是时序误报。
            if (STRUCT_CODES.indexOf(v.code) >= 0) {
                armPending(v.code + ' ' + v.detail, appliedSig ? PENDING_LATE_MS : PENDING_FIRST_MS);
                return false;
            }
            fallbackToDefault(v.code, v.detail);
            return false;
        }

        try {
            stopPending();
            injectCss(STYLE_ID, buildCss(theme, v.colMap, v.headText));
            paintRows(v.colMap);
            translateLeeching();
            currentId = theme.id;
            appliedSig = colMapSig(v.colMap, v.headText);
            appliedAbsent = v.absent || [];
            document.documentElement.dataset.hduiTheme = theme.id;
            document.documentElement.dataset.hduiState = 'applied';
            storeSet(STORE_ERR, null);
            Diag.info('THEME_ON', theme.name + '(' + theme.id + ') 已应用 [' + v.code + ']; '
                + (v.code === 'OK_NO_TABLE' ? '本页无种子表, 只应用全局样式'
                    : (v.code === 'OK_NO_CALC' ? v.detail : '列映射完整')));
            syncUiVars();
            dockUi();
            watchStructure();
            renderPanel();
            return true;
        } catch (e) {
            Diag.fail('E_APPLY_FAILED', e);
            fallbackToDefault('E_APPLY_FAILED', (e && e.message) || String(e));
            return false;
        }
    }

    function applyStored(isRetry) {
        // 首次安装直接上妆胶片墙: 装这个脚本就是为了用它, 且面板里随时可切回「原站默认」。
        // ⚠️ 只有**无存储**时才走 FIRST_ID; 用户一旦选过(含选「原站默认」)就以存储值为准。
        const id = storeGet(STORE_THEME, FIRST_ID);
        applyTheme(id, !!isRetry);
    }

    function selectTheme(id) {
        storeSet(STORE_THEME, id);
        applyTheme(id, false);
    }

    function cycleTheme() {
        const ids = [DEFAULT_ID];
        for (let i = 0; i < THEMES.length; i++) ids.push(THEMES[i].id);
        const at = ids.indexOf(currentId);
        selectTheme(ids[(at + 1) % ids.length]);
    }

    // ==================================================================
    // 运行时结构守卫: 页面局部刷新后重新校验, 失效即回退(防"页面变了还带着旧妆")
    // ==================================================================
    function stopWatch() {
        if (observer) { observer.disconnect(); observer = null; }
        if (watchTimer) { clearTimeout(watchTimer); watchTimer = 0; }
    }

    /**
     * 结构变了之后怎么办:
     *   - 还在等结构就绪 -> 立刻再试一次那个主题;
     *   - 列集合变了(外部脚本把 A / A·GB 补进来了, 或者撤走了) -> 重摆一次, 让 nth-child 重新对齐;
     *   - 结构真的坏了 -> 先等短窗口, 超时才回退(补列补一半的时刻不该弹横幅)。
     */
    function onStructureChange() {
        try {
            if (pendingUntil) {
                const id = storeGet(STORE_THEME, FIRST_ID);
                if (id !== DEFAULT_ID) applyTheme(id);
                return;
            }
            if (currentId === DEFAULT_ID) return;
            const v = validateContract();
            if (!v.ok) {
                Diag.error('E_STRUCTURE_CHANGED', '页面结构在运行中变化: ' + v.detail);
                currentId = DEFAULT_ID;
                if (STRUCT_CODES.indexOf(v.code) >= 0) {
                    armPending(v.code + ' ' + v.detail, PENDING_LATE_MS);
                    return;
                }
                fallbackToDefault('E_STRUCTURE_CHANGED', v.detail);
                return;
            }
            const sig = colMapSig(v.colMap, v.headText);
            if (sig !== appliedSig) {
                Diag.info('COLS_CHANGED', '种子表列集合变化: ' + appliedSig + ' -> ' + sig);
                applyTheme(currentId);
                return;
            }
            clearPaint();
            paintRows(v.colMap);
            translateLeeching();
            appliedAbsent = v.absent || [];
        } catch (e) {
            Diag.fail('E_WATCH_FAILED', e);
        }
    }

    function watchStructure() {
        stopWatch();
        const scope = document.getElementById('outer') || document.body;
        if (!scope || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(function () {
            if (watchTimer) clearTimeout(watchTimer);
            watchTimer = setTimeout(function () {
                watchTimer = 0;
                onStructureChange();
            }, 500);
        });
        observer.observe(scope, { childList: true, subtree: true });
    }

    // ==================================================================
    // 自持 UI: 内嵌开关 + 下拉面板(closed shadow, 事件不冒泡到站内)
    // ------------------------------------------------------------------
    // 入口不再是右下角浮动圆钮: 它跟其它脚本的 FAB 抢同一个位置。改为量取
    // ul#mainmenu 最后一个导航项的右边空档, 把开关摆成导航栏末尾的一个小文字钮。
    // ==================================================================
    let uiRoot = null;
    let uiShadow = null;
    let uiPanel = null;

    function el(tag, text, style) {
        const n = document.createElement(tag);
        if (text !== undefined) n.textContent = text;
        if (style) n.style.cssText = style;
        return n;
    }

    // all:initial 之后宿主是 0 内容盒, 必须显式给尺寸, 否则内容会溢出到视口外
    const HOST_BASE = 'all:initial;display:block;position:absolute;width:' + DOCK_W + 'px;'
        + 'height:' + DOCK_H + 'px;z-index:2147483000;';

    /**
     * 量出开关该摆的位置(视口坐标)。
     *
     * 首选: 导航第一行**右端的预留槽位**(`ul#mainmenu` 的 padding-right = --hdui-navreserve)。
     *   ⚠️ 不能退化成"跟在最后一个 li 右边": 真站 16 项在 ~1262px 下几乎占满一行,
     *   那样入口会掉到第二行、正好压在 #info_block 上(实测如此)。留出槽位就与"压站内内容"绝缘。
     * 退路: 主框架右上 -> null(交给 fixed 兜底)。
     */
    function dockRect() {
        const menu = document.querySelector('ul#mainmenu');
        if (menu) {
            const mr = menu.getBoundingClientRect();
            if (mr.width > DOCK_W + 40) {
                const items = menu.querySelectorAll('li');
                const first = items.length ? items[0].getBoundingClientRect() : null;
                // 第一行的高度用第一个 li 量(它在第一行)
                const rowH = (first && first.height > 0) ? first.height : DOCK_H;
                const rowTop = first ? first.top : mr.top;
                return {
                    left: mr.right - DOCK_W - 8,
                    top: rowTop + (rowH - DOCK_H) / 2
                };
            }
        }
        const frame = document.querySelector('table.mainouter');
        if (frame) {
            const fr = frame.getBoundingClientRect();
            if (fr.width > 0) return { left: Math.max(8, fr.right - DOCK_W - 12), top: fr.top + 8 };
        }
        return null;
    }

    /**
     * 把开关摆到页面里(absolute + 文档坐标), 主题换了/窗口变了都要重摆。
     * 注意: 这里只改 left/top/position, 绝不用 cssText 整体重写 ——
     * cssText 会把宿主上的 --ui-* 配色变量一并清掉(它们在 HOST_BASE 里)。
     */
    function dockUi() {
        if (!uiRoot) return;
        const d = dockRect();
        if (!d) {
            // 页面既没有导航也没有主框架(例如"我的"这类二级页) —— 退化成 fixed 兜底。
            // ⚠️ 挂**左下角**而不是右上: 右上角会与站内通知条/其它脚本的 FAB 抢位,
            //    右下角又常是站点的"给我留言"之类浮动入口。左下是全站最空的角落。
            uiRoot.style.position = 'fixed';
            uiRoot.style.left = '12px';
            uiRoot.style.bottom = '12px';
            uiRoot.style.top = 'auto';
            uiRoot.style.right = 'auto';
            return;
        }
        uiRoot.style.position = 'absolute';
        uiRoot.style.right = 'auto';
        uiRoot.style.left = Math.round(d.left + window.scrollX) + 'px';
        uiRoot.style.top = Math.round(Math.max(0, d.top) + window.scrollY) + 'px';
    }

    /** 面板跟着开关走: 固定在开关下方, 空间不够就往上翻 */
    function placePanel() {
        if (!uiPanel || !uiRoot) return;
        const r = uiRoot.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const h = uiPanel.offsetHeight || 320;
        let left = Math.min(Math.max(8, r.left), Math.max(8, vw - uiPanel.offsetWidth - 8));
        let top = r.bottom + 6;
        if (top + h > vh - 8 && r.top - 6 - h > 8) top = r.top - 6 - h;
        uiPanel.style.left = Math.round(left) + 'px';
        uiPanel.style.top = Math.round(Math.max(8, top)) + 'px';
    }

    /** 自持 UI 的配色跟随当前主题(默认界面时用中性深色, 保证任何底色下都读得清) */
    function syncUiVars() {
        if (!uiRoot) return;
        const v = (themeById(currentId) || DEFAULT_THEME).vars || {};
        const pick = function (k, def) { return v[k] || def; };
        uiRoot.style.setProperty('--ui-bg', pick('--hdui-card', '#1b1e23'));
        uiRoot.style.setProperty('--ui-panel', pick('--hdui-panel', '#16181c'));
        uiRoot.style.setProperty('--ui-fg', pick('--hdui-fg', '#ece7de'));
        uiRoot.style.setProperty('--ui-muted', pick('--hdui-muted', '#8b8f96'));
        uiRoot.style.setProperty('--ui-dim', pick('--hdui-dim', '#6b6f76'));
        uiRoot.style.setProperty('--ui-accent', pick('--hdui-accent', '#c8a35a'));
        uiRoot.style.setProperty('--ui-line', pick('--hdui-line', '#2c3037'));
        uiRoot.style.setProperty('--ui-font', pick('--hdui-font', '"Microsoft YaHei",sans-serif'));
        setDockLabel();
    }

    /**
     * 自持 UI 的样式(closed shadow 内, 与站内 CSS 完全隔离)。
     * 对齐原型 `film.html`: 入口 = 空心胶囊(金边 + 6px 金点 + 三角 caret + hover 金底);
     * 面板 = 16px 圆角浮层卡, 2 列, 每项 30px 图标方块 + 名称/说明。
     */
    function panelCss() {
        return [
            // ---- 入口: 导航栏预留槽位里的胶囊钮 ----
            '.dock{display:flex;align-items:center;gap:6px;width:100%;height:100%;padding:0 11px;',
            'box-sizing:border-box;border-radius:999px;cursor:pointer;white-space:nowrap;',
            'user-select:none;overflow:hidden;background:rgba(255,255,255,.045);',
            'border:1px solid rgba(245,179,66,.32);color:var(--ui-muted);',
            'font:11.5px/1 var(--ui-font,"Microsoft YaHei",sans-serif);',
            'transition:background .14s,border-color .14s,color .14s;}',
            '.dock:hover,.dock:focus-visible{background:rgba(245,179,66,.13);',
            'border-color:var(--ui-accent);color:var(--ui-fg);}',
            '.dock .dot{width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:var(--ui-accent);}',
            '.dock .label{opacity:.85;}',
            '.dock .name{overflow:hidden;text-overflow:ellipsis;color:var(--ui-accent);font-weight:600;}',
            // 三角 caret 用边框画(原型的 em)
            '.dock .caret{width:0;height:0;flex:0 0 auto;border:3.5px solid transparent;',
            'border-top-color:currentColor;margin-top:3px;opacity:.7;}',
            // ---- 面板: 卡片式浮层 ----
            '.panel{position:fixed;display:none;grid-template-columns:1fr 1fr;gap:8px;width:340px;',
            'max-height:min(430px,calc(100vh - 24px));overflow:auto;padding:12px;box-sizing:border-box;',
            'border-radius:16px;background:var(--ui-panel);color:var(--ui-fg);',
            'border:1px solid var(--ui-line);',
            'box-shadow:0 20px 50px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.03);',
            'font:12.5px/1.5 var(--ui-font,"Microsoft YaHei",sans-serif);z-index:2147483000;}',
            '.panel.open{display:grid;}',
            '.panel h3{grid-column:1/-1;margin:0 0 2px;font-size:12px;font-weight:600;color:var(--ui-muted);}',
            '.item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px;',
            'cursor:pointer;background:transparent;color:var(--ui-fg);border:1px solid var(--ui-line);',
            'border-radius:11px;font:12.5px/1.35 inherit;transition:border-color .14s,background .14s;}',
            '.item:hover{border-color:rgba(245,179,66,.45);background:rgba(255,255,255,.04);}',
            '.item[aria-pressed="true"]{border-color:var(--ui-accent);background:rgba(245,179,66,.12);}',
            '.item i{width:30px;height:30px;flex:0 0 30px;border-radius:9px;',
            'background-repeat:no-repeat;background-position:center;background-size:16px 16px;}',
            '.item span{display:flex;flex-direction:column;gap:2px;min-width:0;}',
            '.item b{font-weight:500;}',
            '.item small{color:var(--ui-muted);font-size:10.5px;opacity:.65;}',
            '.item[aria-pressed="true"] b{color:var(--ui-accent);}',
            // ---- 诊断区 ----
            '.diag{grid-column:1/-1;margin-top:4px;border-top:1px solid var(--ui-line);padding-top:8px;',
            'color:var(--ui-muted);font-size:10px;}',
            '.diag code{color:var(--ui-accent);font-family:ui-monospace,Consolas,monospace;}',
            '.hint{grid-column:1/-1;color:var(--ui-muted);font-size:10px;}'
        ].join('');
    }

    function closePanel() {
        if (uiPanel) {
            uiPanel.className = 'panel';
            uiPanel.style.left = '-9999px';
            uiPanel.style.top = '-9999px';
        }
        disarmAutoClose();
    }

    function openPanel() {
        if (!uiPanel) return;
        renderPanel();
        uiPanel.className = 'panel open';
        placePanel();
        armAutoClose();
    }

    // 失焦/点页面别处就收起(只在展开期间挂监听, 收起即摘)
    let autoCloseOn = false;
    function onOutsideDown(e) {
        if (!uiPanel || uiPanel.className.indexOf('open') < 0) return;
        if (uiRoot && uiRoot.contains(e.target)) return;
        closePanel();
    }
    function armAutoClose() {
        if (autoCloseOn) return;
        autoCloseOn = true;
        document.addEventListener('mousedown', onOutsideDown, true);
        window.addEventListener('scroll', onPanelViewport, true);
    }
    function disarmAutoClose() {
        if (!autoCloseOn) return;
        autoCloseOn = false;
        document.removeEventListener('mousedown', onOutsideDown, true);
        window.removeEventListener('scroll', onPanelViewport, true);
    }

    // 两个重排入口分开注册: disarm 只摘「面板展开期间」的那些, 常驻的 resize 重摆不受影响
    let rafPanel = false;
    function onPanelViewport() {
        if (rafPanel) return;
        rafPanel = true;
        requestAnimationFrame(function () {
            rafPanel = false;
            try {
                if (!uiPanel || uiPanel.className.indexOf('open') < 0) return;
                const r = uiRoot ? uiRoot.getBoundingClientRect() : null;
                if (!r || r.bottom < 0 || r.top > window.innerHeight) closePanel();
                else placePanel();
            } catch (e) { Diag.fail('E_UI_RELAYOUT', e); }
        });
    }

    let rafDock = false;
    function onDockResize() {
        if (rafDock) return;
        rafDock = true;
        requestAnimationFrame(function () {
            rafDock = false;
            try {
                dockUi();
                if (uiPanel && uiPanel.className.indexOf('open') >= 0) placePanel();
            } catch (e) { Diag.fail('E_UI_RELAYOUT', e); }
        });
    }

    function renderPanel() {
        if (!uiShadow || !uiPanel) return;
        while (uiPanel.firstChild) uiPanel.removeChild(uiPanel.firstChild);

        uiPanel.appendChild(el('h3', ScriptName + ' · 界面主题'));

        const all = [DEFAULT_THEME];
        for (let i = 0; i < THEMES.length; i++) all.push(THEMES[i]);
        for (let i = 0; i < all.length; i++) {
            const t = all[i];
            const on = t.id === currentId;
            const btn = el('button', undefined, '');
            btn.className = 'item';
            btn.setAttribute('type', 'button');
            btn.setAttribute('data-hdui-theme-id', t.id);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            // 30px 图标方块: 选中金底金图, 未选中性底
            const ic = el('i', undefined, '');
            ic.setAttribute('data-hdui', 'item-icon');
            ic.style.backgroundImage = iconUri(t.icon || 'dot', on ? FILM_ACCENT : '#a79e93');
            ic.style.backgroundColor = on ? rgba(FILM_ACCENT, 0.16) : 'rgba(255,255,255,.05)';
            btn.appendChild(ic);
            const box = el('span', undefined, '');
            box.appendChild(el('b', t.name));
            box.appendChild(el('small', t.note));
            btn.appendChild(box);
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                selectTheme(t.id);
            });
            uiPanel.appendChild(btn);
        }

        const diag = el('div', undefined, '');
        diag.className = 'diag';
        const head = el('div', undefined, '');
        head.appendChild(document.createTextNode('当前: '));
        head.appendChild(el('code', String(currentId)));
        diag.appendChild(head);

        // A / A·GB 是别的脚本注入的, 面板里说清楚它到底在不在 —— 排查时序问题全靠这一行
        const calcLine = el('div', undefined, '');
        calcLine.appendChild(document.createTextNode('A / A·GB: '));
        calcLine.appendChild(el('code', appliedAbsent.length ? '外部脚本未注入, 已跳过' : '已接管'));
        diag.appendChild(calcLine);
        if (pendingUntil) {
            diag.appendChild(el('div', '等待外部脚本补列中…'));
        }

        const err = storeGet(STORE_ERR, null);
        if (err && err.code) {
            const line = el('div', undefined, '');
            line.appendChild(document.createTextNode('上次错误: '));
            line.appendChild(el('code', String(err.code)));
            diag.appendChild(line);
        }
        const recent = Diag.list().slice(-5);
        for (let i = 0; i < recent.length; i++) {
            diag.appendChild(el('div', recent[i].level.toUpperCase() + ' ' + recent[i].code));
        }
        uiPanel.appendChild(diag);
        const hint = el('div', '快捷键 Alt+Shift+T 循环切换', '');
        hint.className = 'hint';
        uiPanel.appendChild(hint);
        if (uiPanel.className.indexOf('open') >= 0) placePanel();
    }

    function setDockLabel() {
        if (!uiShadow) return;
        const dock = uiShadow.querySelector('.dock .name');
        if (dock) dock.textContent = (themeById(currentId) || DEFAULT_THEME).name;
    }

    function mountUi() {
        if (uiRoot || !document.body) return;
        uiRoot = document.createElement('div');
        uiRoot.setAttribute('id', ROOT_ID);
        uiRoot.setAttribute('data-hdui', 'root');
        // 宿主必须显式给尺寸: all:initial 之后它是 0 内容盒, 撑不开就会溢出视口外
        uiRoot.style.cssText = HOST_BASE;
        uiShadow = uiRoot.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = panelCss();
        uiShadow.appendChild(style);

        const dock = el('button', undefined, '');
        dock.className = 'dock';
        dock.setAttribute('type', 'button');
        dock.setAttribute('data-hdui', 'dock');
        dock.setAttribute('title', ScriptName + ' 界面主题');
        // 原型的 chip 三件套: 金点 + 「界面 · 主题名」 + 三角 caret
        const dot = el('span', undefined, '');
        dot.className = 'dot';
        const label = el('span', '界面 ·', '');
        label.className = 'label';
        const name = el('span', (themeById(currentId) || DEFAULT_THEME).name, '');
        name.className = 'name';
        const caret = el('span', undefined, '');
        caret.className = 'caret';
        dock.appendChild(dot);
        dock.appendChild(label);
        dock.appendChild(name);
        dock.appendChild(caret);
        dock.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (uiPanel && uiPanel.className.indexOf('open') >= 0) closePanel();
            else openPanel();
        });
        uiShadow.appendChild(dock);

        uiPanel = el('div', undefined, '');
        uiPanel.className = 'panel';
        uiPanel.setAttribute('data-hdui', 'panel');
        uiPanel.style.left = '-9999px';
        uiPanel.style.top = '-9999px';
        // 面板整体阻断冒泡: 点到我们 UI 的事件不传给站内 document 级监听
        uiPanel.addEventListener('click', function (e) { e.stopPropagation(); });
        uiPanel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        uiShadow.appendChild(uiPanel);

        document.body.appendChild(uiRoot);
        syncUiVars();
        dockUi();
    }

    // ==================================================================
    // 启动
    // ==================================================================
    function onKeydown(e) {
        if (!e.altKey || !e.shiftKey) return;
        const k = e.key || '';
        if (k !== 'T' && k !== 't') return;
        const a = document.activeElement;
        if (a) {
            const tag = (a.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || a.isContentEditable) return;
        }
        e.preventDefault();
        cycleTheme();
    }

    let bootObserver = null;

    function stopBootWatch() {
        if (bootObserver) { bootObserver.disconnect(); bootObserver = null; }
    }

    /**
     * 铺一层主题底色, 避免加载瞬间闪一下原站配色(回退时由 unload() 撤掉)。
     * 真正的 document-start 上 <head> 通常还没建, injectCss 会自动退到 <html>;
     * 若连 <html> 都尚未创建(注入点比真实 Tampermonkey 更早时会出现), 返回 false。
     */
    function paintBootBg() {
        const theme = themeById(storeGet(STORE_THEME, FIRST_ID));
        if (!theme || !theme.vars['--hdui-bg']) return false;
        if (!document.documentElement) return false;
        injectCss(BOOT_ID, 'html{background:' + theme.vars['--hdui-bg'] + ';}');
        return true;
    }

    /** <html> 还没出现时退一步: 它一被创建就立刻铺上(仍早于首屏渲染与 DOMContentLoaded) */
    function paintBootBgWhenPossible() {
        if (paintBootBg()) return;
        if (typeof MutationObserver !== 'function') return;
        bootObserver = new MutationObserver(function () {
            if (paintBootBg()) stopBootWatch();
        });
        bootObserver.observe(document, { childList: true });
    }

    function boot() {
        // 全局兜底: 只记录, 不吞掉(不 preventDefault、不改返回值)
        window.addEventListener('error', function (ev) {
            Diag.error('UNCAUGHT', (ev && ev.message) ? ev.message : 'unknown');
        });
        window.addEventListener('unhandledrejection', function (ev) {
            // 本脚本没有任何 Promise / async(静态校验 §10 钉死这一点), 所以这里捕获到的 rejection
            // **一定来自页面自身或其它脚本** —— 它是全局兜底, 不是我们的 bug。
            // 因此必须: ① 带上首个堆栈帧, 让人能找到真正的来源;
            //          ② 明确标注"来自外部", 否则 [HDHomeUI] 前缀会把人引到错误的脚本上。
            const r = ev && ev.reason;
            const msg = r ? String((r && r.message) || r) : 'unknown';
            let frame = '';
            if (r && r.stack) {
                const m = /^\s*at\s+(.+)$/m.exec(String(r.stack));
                if (m) frame = ' @ ' + m[1].trim().slice(0, 160);
            }
            Diag.warn('UNHANDLED_REJECTION', msg + frame
                + ' —— 来自页面或其它脚本(本脚本无异步代码), 非 HDHomeUI 故障');
        });

        // 底色已在 document-start 铺过; 若那时连 <html> 都还没建则在这里补最后一次
        stopBootWatch();
        if (!document.getElementById(BOOT_ID)) paintBootBg();

        mountUi();
        applyStored(false);
        document.addEventListener('keydown', onKeydown);
        window.addEventListener('resize', onDockResize); // 常驻: 窗口变了要重摆内嵌开关
    }

    // @run-at document-start: 此处即真正的 document-start(DOM 尚未解析), 先把底色铺上
    // (<html> 若尚未创建, 由 paintBootBgWhenPossible 退化为"一出现就铺")
    try { paintBootBgWhenPossible(); } catch (e) { Diag.fail('E_BOOT_PAINT', e); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            try { boot(); } catch (e) { Diag.fail('E_BOOT_FAILED', e); }
        }, { once: true });
    } else {
        try { boot(); } catch (e) { Diag.fail('E_BOOT_FAILED', e); }
    }
})();
