// ==UserScript==
// @name         BTSchool Auto Download Small Torrents
// @name:zh-CN   BTSchool自动下载小种子
// @namespace    https://github.com/ABackerNINI/TampermonkeyScripts
// @version      2026.07.28.1
// @description  自动下载BTSchool的种子文件, 仅限小种子(小于1GB)
// @author       ABacker
// @match        https://pt.btschool.club/torrents.php*
// @icon         https://pt.btschool.club/favicon.ico
// @grant        none
// @run-at       document-end
// @license      GNU GPL-3.0
// @tag          BTSchool
// @supportURL   https://github.com/ABackerNINI/TampermonkeyScripts/issues
// ==/UserScript==

const ScriptName = 'BTSchool自动下载小种子';

const TorrentState = Object.freeze({
    NORMAL: 'normal',
    FREE: '免费',
    _2XUP: '2x上传',
    FREE_2XUP: '免费&2x上传',
    _50PCT_DOWN: '50%下载',
    _50PCT_DOWN_2XUP: '50%下载&2x上传',
    _30PCT_DOWN: '30%下载'
});

const TorrentStateAltMap = Object.freeze({
    '': TorrentState.NORMAL,
    'Free': TorrentState.FREE,
    '2X': TorrentState._2XUP,
    '2X Free': TorrentState.FREE_2XUP,
    '50%': TorrentState._50PCT_DOWN,
    '2X 50%': TorrentState._50PCT_DOWN_2XUP,
    '30%': TorrentState._30PCT_DOWN
});

const TorrentStateClassMap = Object.freeze({
    '': TorrentState.NORMAL,
    'pro_free': TorrentState.FREE,
    'pro_2xup': TorrentState._2XUP,
    'pro_free2up': TorrentState.FREE_2XUP,
    'pro_50pctdown': TorrentState._50PCT_DOWN,
    'pro_50pctdown2up': TorrentState._50PCT_DOWN_2XUP,
    'pro_30pctdown': TorrentState._30PCT_DOWN
});

(function () {
    'use strict';

    function findTextNodeContaining(root, text) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes(text)) {
                return node;
            }
        }
        return null;
    }

    /**
     * 通过文本 "剩余时间：" 定位 span，并获取其绝对时间（title）和相对时间（文本）
     * @param {string} textMarker - 标记文本，默认为 "剩余时间："
     * @returns {object|null} 返回 { absolute, absoluteStr, relativeStr }，若未找到 span 则返回 null
     */
    function getRemainingTimeByText(node, textMarker = '剩余时间：') {
        const textNode = findTextNodeContaining(node, textMarker);
        if (!textNode) {
            // console.warn(`未找到包含 "${textMarker}" 的文本`);
            return null;
        }

        // 获取该文本节点的父元素（通常是 <font> 或 <div>）
        const parent = textNode.parentNode;
        if (!parent) return null;

        // 尝试在父元素内查找第一个 <span> 元素（且具有 title 属性）
        let span = parent.querySelector('span[title]');
        if (!span) {
            console.warn('在 "剩余时间：" 附近未找到带 title 的 span');
            return null;
        }

        // 提取数据
        const absoluteStr = span.getAttribute('title');
        const absolute = new Date(absoluteStr);
        const relativeStr = span.textContent.trim();

        return { absolute: absolute, absoluteStr: absoluteStr, relativeStr: relativeStr };
    }

    function getReleaseTimeFromRowCell(timeCell) {
        const timeSpan = timeCell ? timeCell.querySelector('span[title]') : null;
        const absoluteStr = timeSpan ? timeSpan.getAttribute('title') || '' : '';
        const relativeStr = timeCell ? timeCell.textContent.replace(/\s+/g, ' ').trim() : '';
        const releaseTime = { absolute: new Date(absoluteStr), absoluteStr: absoluteStr, relativeStr: relativeStr };
        return releaseTime;
    }

    function getSizeFromRowCell(sizeCell) {
        const sizeStr = sizeCell ? sizeCell.textContent.replace(/\s+/g, ' ').trim() : '';
        const size = sizeStr ? parseFileSizeInBytes(sizeStr) : null;
        return { sizeStr: sizeStr, size: size };
    }

    function getTorrentStateFromRowCell(stateCell) {
        // 查找 <img> 标签，获取其 class 属性，并转换为种子状态
        const img = stateCell ? stateCell.querySelector('img[class*="pro_"]') : null;
        const className = img ? img.getAttribute('class') || '' : '';
        const state = TorrentStateClassMap[className] || TorrentState.NORMAL;
        return state;
    }

    /**
     * 解析PT站种子表格, 提取所有种子数据
     * @param {string|Element} selector - CSS选择器或表格元素, 默认为 'table.torrents'
     * @returns {Array<Object>} 种子数据数组
     */
    function parseTorrentTable(selector) {
        // 获取表格元素
        const table = typeof selector === 'string'
            ? document.querySelector(selector || 'table.torrents')
            : selector;

        if (!table) {
            console.warn('parseTorrentTable: 未找到表格');
            return [];
        }

        // 获取所有数据行（跳过表头）
        // 注意：<tr> 没有 rowfollow 类, rowfollow 在 <td> 上, 所以用 :scope > td.rowfollow 定位数据行
        const rows = table.querySelectorAll('tbody > tr:has(> td.rowfollow)');
        const result = [];

        console.log('parseTorrentTable: 获取表格行数:', rows.length);

        rows.forEach((row, index) => {
            // 使用 :scope > td 只获取直接子单元格, 避免深度搜索到嵌套表格中的 <td>
            const cells = row.querySelectorAll(':scope > td');
            if (cells.length < 11) {
                console.warn(`parseTorrentTable: 行数据不足11列 @${index}, 实际列数: ${cells.length}`);
                return [];
            }

            try {
                // ---- 1. 类型列 (索引0) ----
                const typeCell = cells[0];
                const catLink = typeCell.querySelector('a[href*="?cat="]');
                const catImg = catLink ? catLink.querySelector('img') : null;
                const encodeImg = typeCell.querySelector('img:not(.c_movie)');

                const category = catImg ? catImg.getAttribute('alt') || '' : '';
                const categoryId = catLink ? (catLink.getAttribute('href').match(/cat=(\d+)/) || [])[1] || '' : '';
                const encode = encodeImg ? encodeImg.getAttribute('alt') || '' : '';

                // ---- 2. 标题列 (索引1) ----
                const titleCell = cells[1];

                // 标题链接和ID
                const detailLink = titleCell.querySelector('a[href*="details.php?id="]');
                const title = detailLink ? detailLink.textContent.trim() : '';
                const titleFull = detailLink ? detailLink.getAttribute('title') || '' : '';
                const detailUrl = detailLink ? detailLink.getAttribute('href') || '' : '';
                const idMatch = detailUrl.match(/id=(\d+)/);
                const id = idMatch ? idMatch[1] : '';

                // 置顶
                const sticky = titleCell.querySelector('img[alt="Sticky"]') !== null;

                // 热门
                const hot = titleCell.querySelector('font.hot') !== null;

                // 免费 & 剩余时间
                const state = getTorrentStateFromRowCell(titleCell);
                const remainingTime = getRemainingTimeByText(titleCell);

                // 官方标签 & 字幕信息
                const officialSpan = titleCell.querySelector('span.label-primary');
                const official = officialSpan !== null;
                let subtitle = '';
                if (officialSpan && officialSpan.nextSibling) {
                    subtitle = officialSpan.nextSibling.textContent.trim();
                } else {
                    // 备用：尝试从br后面的文本提取
                    const br = titleCell.querySelector('br');
                    if (br && br.nextSibling) {
                        const text = br.nextSibling.textContent.trim();
                        if (text && !text.includes('官方')) {
                            subtitle = text;
                        }
                    }
                }

                // 豆瓣评分 & IMDB评分 (在嵌套表格中)
                const ratingCell = titleCell.querySelector('td.embedded[width="50"]');
                let doubanScore = '无';
                let imdbScore = '无';
                if (ratingCell) {
                    const divs = ratingCell.querySelectorAll('div');
                    if (divs.length >= 2) {
                        const dbText = divs[0].textContent.replace(/[^\d.]+/g, '').trim();
                        doubanScore = dbText || '无';
                        const imText = divs[1].textContent.replace(/[^\d.]+/g, '').trim();
                        imdbScore = imText || '无';
                    }
                }

                // 下载链接 & 收藏
                const actionCell = titleCell.querySelector('td.embedded[width="20"]');
                let downloadUrl = '';
                let bookmarkId = '';
                if (actionCell) {
                    const dlLink = actionCell.querySelector('a[href*="download.php"]');
                    if (dlLink) downloadUrl = dlLink.getAttribute('href') || '';
                    const bmLink = actionCell.querySelector('a[id^="bookmark"]');
                    if (bmLink) bookmarkId = bmLink.id || '';
                }

                // ---- 3. 评论数 (索引2) ----
                const commentsText = cells[2] ? cells[2].textContent.trim() : '';
                const numComments = parseCommaIntSafe(commentsText, 10) || 0;

                // ---- 4. 存活时间 (索引3) ----
                const releaseTime = getReleaseTimeFromRowCell(cells[3]);

                // ---- 5. 大小 (索引4) ----
                const sizeInfo = getSizeFromRowCell(cells[4]);

                // ---- 6. 种子数 (索引5) ----
                const seedersText = cells[5] ? cells[5].textContent.trim() : '';
                const seeders = parseCommaIntSafe(seedersText, 0);

                // ---- 7. 下载数 (索引6) ----
                const leechersText = cells[6] ? cells[6].textContent.trim() : '';
                const leechers = parseCommaIntSafe(leechersText, 0);

                // ---- 8. 完成数 (索引7) ----
                const snatchedText = cells[7] ? cells[7].textContent.trim() : '';
                const snatched = parseCommaIntSafe(snatchedText, 0);

                // ---- 9. 时魔 (索引8) ----
                const calcACell = cells[8];
                const calcA = calcACell ? parseCommaIntSafe(calcACell.getAttribute('data-calc-a'), 0) : 0;
                const calcADisplay = calcACell ? calcACell.textContent.trim() : '';

                // ---- 10. 时魔/GB (索引9) ----
                const calcAveCell = cells[9];
                const calcAve = calcAveCell ? parseCommaIntSafe(calcAveCell.getAttribute('data-calc-ave'), 0) : 0;
                const calcAveDisplay = calcAveCell ? calcAveCell.textContent.trim() : '';

                // ---- 11. 发布者 (索引10) ----
                const publisher = cells[10] ? cells[10].textContent.trim() : '';

                // 构建种子对象
                const torrent = {
                    // 基本信息
                    id: id,
                    index: index,

                    // 类型
                    category: category,
                    categoryId: categoryId,
                    encode: encode,

                    // 标题信息
                    title: title,
                    titleFull: titleFull,
                    detailUrl: detailUrl,

                    // 标签
                    sticky: sticky,
                    hot: hot,
                    state: state,
                    remainingTime: remainingTime,
                    official: official,
                    subtitle: subtitle,

                    // 评分
                    doubanScore: doubanScore,
                    imdbScore: imdbScore,

                    // 操作
                    downloadUrl: downloadUrl,
                    bookmarkId: bookmarkId,

                    // 统计数据
                    numComments: numComments,
                    releaseTime: releaseTime,
                    size: sizeInfo.size,
                    sizeStr: sizeInfo.sizeStr,
                    seeders: seeders,
                    leechers: leechers,
                    snatched: snatched,

                    // 魔力值
                    calcA: calcA,
                    calcADisplay: calcADisplay,
                    calcAve: calcAve,
                    calcAveDisplay: calcAveDisplay,

                    // 发布者
                    publisher: publisher,

                    // 原始行引用（方便调试）
                    _row: row
                };

                result.push(torrent);

            } catch (err) {
                console.warn(`parseTorrentTable: 解析第 ${index + 1} 行时出错`, err);
            }
        });

        return result;
    }

    function parseCommaInt(str) {
        if (typeof str !== 'string') {
            str = String(str); // 兼容传入数字的情况
        }

        const cleaned = str.replace(/,/g, '').trim();

        // 如果清空后不是纯数字（含字母等）, 返回 NaN 或自定义默认值
        if (!/^-?\d+$/.test(cleaned)) { // 支持负数
            return NaN;
        }

        return parseInt(cleaned, 10);
    }

    function parseCommaIntSafe(str, fallback = NaN) {
        const num = parseCommaInt(str);
        return isNaN(num) ? fallback : num;
    }

    /**
     * 将带逗号的数字字符串解析为 Number（浮点数）
     * @param {string} str - 如 "1,234.56" 或 "12,345,678.99"（支持负号, 支持前后空格）
     * @returns {number} 解析后的数值, 如果无效则返回 NaN
     */
    function parseCommaNumber(str) {
        if (typeof str !== 'string') {
            str = String(str); // 兼容传入数字的情况
        }
        // 去除所有逗号, 并去除首尾空格
        const cleaned = str.replace(/,/g, '').trim();
        // 使用 Number 转换（相当于浮点数解析）
        return Number(cleaned);
    }

    function parseCommaNumberSafe(str, fallback = NaN) {
        const num = parseCommaNumber(str);
        return isNaN(num) ? fallback : num;
    }

    /**
     * 将文件大小字符串转换为字节数
     * @param {string} sizeStr - 格式如 "12GB"、"13.12MB"、"1.5K" 等（不区分大小写）
     * @returns {number} 对应的字节数
     * @throws {Error} 格式无效或单位不支持时抛出异常
     */
    function parseFileSizeInBytes(sizeStr) {
        // 定义单位与字节数的映射（按二进制 1024 进制）
        const unitBytes = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 ** 2,
            'GB': 1024 ** 3,
            'TB': 1024 ** 4,
            'PB': 1024 ** 5
        };

        // 用正则提取数字和单位（允许数字带小数, 允许逗号分隔符, 允许单位前有空格）
        const match = sizeStr.match(/^([\d.,]+)\s*([KMGTP]?B?)$/i);
        if (!match) {
            throw new Error(`无效的大小格式: "${sizeStr}", 应为 "12GB" 或 "13.12MB" 等形式`);
        }

        let num = parseCommaNumber(match[1]);
        let unit = match[2].toUpperCase();

        // 处理简写：如 "K" -> "KB", "M" -> "MB" 等
        if (['K', 'M', 'G', 'T', 'P'].includes(unit)) {
            unit += 'B';
        }

        // 检查单位是否支持
        if (!(unit in unitBytes)) {
            throw new Error(`未知单位: "${unit}", 支持的单位有 B, KB, MB, GB, TB, PB`);
        }

        // 计算字节数
        const bytes = num * unitBytes[unit];

        return bytes;
    }

    // ========== 使用示例 ==========

    function showTorrents(torrents) {
        console.log('共解析到', torrents.length, '个种子');

        // 2. 访问所有种子的所有信息
        torrents.forEach((t, index) => {
            console.log(`第 ${index + 1} 个种子:`, t);
            console.log(`文件大小: ${t.size}, 对应字节数: ${t.size}`);
        });

        // 3. 筛选免费种子
        const freeTorrents = torrents.filter(t => t.free);
        console.log('免费种子数:', freeTorrents.length);

        // 4. 按种子数排序（从多到少）
        const sorted = [...torrents].sort((a, b) => b.seeders - a.seeders);
        console.log('种子数最多的:', sorted[0]?.title, sorted[0]?.seeders);

        // 5. 获取所有种子ID
        const ids = torrents.map(t => t.id);
        console.log('种子ID列表:', ids);

        // 6. 按大小排序（需要解析大小, 这里仅作示例）
        // 实际使用时可以写一个解析大小的辅助函数
        const bySize = [...torrents].sort((a, b) => {
            return b.size - a.size;
        });
        console.log('最大的种子:', bySize[0]?.title, bySize[0]?.size);
    }

    // 1. 基本使用 - 解析表格并打印结果
    var torrents = [];

    const maxTryCount = 10;
    var tryCount = 0;
    var getTorrentsTimer = setInterval(function () {
        tryCount++;
        console.log(`[${ScriptName}] 尝试获取种子次数: ${tryCount}`);
        torrents = parseTorrentTable('table.torrents');
        if (torrents.length > 0 || tryCount >= maxTryCount) {
            showTorrents(torrents);
            clearInterval(getTorrentsTimer);
        }
    }, 500);

    console.log(`[${ScriptName}] 脚本已加载`);
})();
