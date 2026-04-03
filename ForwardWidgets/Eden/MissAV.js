var WidgetMetadata = {
    id: "missav_widget",
    title: "MissAV",
    description: "获取 MissAV 影片内容",
    author: "skywazzle",
    site: "https://missav.ai",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "搜索影片",
            description: "搜索 MissAV 影片内容",
            requiresWebView: false,
            functionName: "searchVideos",
            cacheDuration: 1800,
            params: [
                {
                    name: "keyword",
                    title: "搜索关键词",
                    type: "input",
                    description: "输入搜索关键词（标题、番号、演员等）",
                    value: ""
                },
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        },
        {
            title: "最新影片",
            description: "最新上传的影片",
            requiresWebView: false,
            functionName: "loadLatest",
            cacheDuration: 1800,
            params: [
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        },
        {
            title: "今日热门",
            description: "今日热门影片",
            requiresWebView: false,
            functionName: "loadTodayHot",
            cacheDuration: 1800,
            params: [
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        },
        {
            title: "本周热门",
            description: "本周热门影片",
            requiresWebView: false,
            functionName: "loadWeeklyHot",
            cacheDuration: 1800,
            params: [
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        },
        {
            title: "本月热门",
            description: "本月热门影片",
            requiresWebView: false,
            functionName: "loadMonthlyHot",
            cacheDuration: 1800,
            params: [
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        },
        {
            title: "中文字幕",
            description: "中文字幕影片",
            requiresWebView: false,
            functionName: "loadChineseSubtitle",
            cacheDuration: 1800,
            params: [
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        },
        {
            title: "影片分类",
            description: "按分类浏览影片",
            requiresWebView: false,
            functionName: "loadByGenre",
            cacheDuration: 1800,
            params: [
                {
                    name: "genre",
                    title: "选择分类",
                    type: "enumeration",
                    description: "选择具体分类",
                    value: "amateur",
                    enumOptions: [
                        { title: "素人", value: "amateur" },
                        { title: "单体作品", value: "single" },
                        { title: "巨乳", value: "big-tits" },
                        { title: "美少女", value: "beautiful-girl" },
                        { title: "熟女", value: "mature-woman" },
                        { title: "女学生", value: "female-student" },
                        { title: "人妻", value: "married-woman" },
                        { title: "痴汉", value: "molester" },
                        { title: "无码", value: "uncensored" },
                        { title: "中文字幕", value: "chinese-subtitle" }
                    ]
                },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    description: "排序方式",
                    value: "new",
                    enumOptions: [
                        { title: "最新", value: "new" },
                        { title: "最多观看", value: "views" },
                        { title: "最高评分", value: "rating" }
                    ]
                },
                { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
            ]
        }
    ]
};

const BASE_URL = "https://missav.ai";
const REQUEST_TIMEOUT = 10000;

function getCommonHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": BASE_URL,
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
    };
}

async function httpGetWithTimeout(url) {
    return Widget.http.get(url, {
        headers: getCommonHeaders(),
        timeout: REQUEST_TIMEOUT
    });
}

function normalizeImageUrl(src) {
    if (!src) return "";
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("/")) return BASE_URL + src;
    if (!src.startsWith("http")) return BASE_URL + "/" + src;
    return src;
}

/**
 * 解析 MissAV 列表页
 * 影片卡片结构：
 *   <div class="thumbnail-container">
 *     <a href="/zh/XXXX-XXX">
 *       <img data-src="..." alt="标题" />
 *     </a>
 *     <div class="detail">
 *       <a class="text-secondary" href="/zh/XXXX-XXX">标题</a>
 *     </div>
 *   </div>
 */
async function fetchAndParse(url) {
    try {
        const response = await httpGetWithTimeout(url);
        const $ = Widget.html.load(response.data);
        const items = [];
        const seen = new Set();

        // MissAV 影片链接格式：/zh/番号 或 /番号
        $('a[href]').each((i, el) => {
            const $a = $(el);
            const href = $a.attr('href') || "";

            // 仅匹配影片详情链接（排除分类/标签/演员等页面）
            if (!/\/(zh\/)?[a-zA-Z]+-\d+(\?.*)?$/.test(href)) return;
            // 排除导航链接
            if (/\/(genres|actresses|makers|series|login|register|user)/.test(href)) return;

            let link = href;
            if (!link.startsWith('http')) {
                link = BASE_URL + (link.startsWith('/') ? '' : '/') + link;
            }

            if (seen.has(link)) return;
            seen.add(link);

            // 取封面图
            const $img = $a.find('img').first();
            let poster = $img.attr('data-src') || $img.attr('src') || "";
            poster = normalizeImageUrl(poster);

            // 取标题：优先 img alt，再取 a 的文本，再取附近 .text-secondary
            let title = $img.attr('alt') || $a.attr('title') || "";
            if (!title) {
                title = $a.closest('[class*="thumbnail"], [class*="video"], [class*="item"]')
                    .find('[class*="title"], .text-secondary')
                    .first().text().trim();
            }
            if (!title) title = $a.text().trim();
            if (!title || title.length < 3) return;

            // 时长
            const duration = $a.find('[class*="duration"], [class*="time"]').first().text().trim();

            items.push({
                id: link,
                type: "url",
                title: title,
                posterPath: poster,
                backdropPath: poster,
                mediaType: "movie",
                durationText: duration,
                link: link
            });
        });

        return items;
    } catch (e) {
        console.error(`Fetch error for ${url}:`, e);
        return [];
    }
}

// --- 模块功能函数 ---

async function searchVideos(params) {
    const page = params.page || 1;
    const keyword = params.keyword || "";
    let url = `${BASE_URL}/zh/search?query=${encodeURIComponent(keyword)}`;
    if (page > 1) url += `&page=${page}`;
    return fetchAndParse(url);
}

async function loadLatest(params) {
    const page = params.page || 1;
    let url = `${BASE_URL}/zh/new`;
    if (page > 1) url += `?page=${page}`;
    return fetchAndParse(url);
}

async function loadTodayHot(params) {
    const page = params.page || 1;
    let url = `${BASE_URL}/zh/today-hot`;
    if (page > 1) url += `?page=${page}`;
    return fetchAndParse(url);
}

async function loadWeeklyHot(params) {
    const page = params.page || 1;
    let url = `${BASE_URL}/zh/weekly-hot`;
    if (page > 1) url += `?page=${page}`;
    return fetchAndParse(url);
}

async function loadMonthlyHot(params) {
    const page = params.page || 1;
    let url = `${BASE_URL}/zh/monthly-hot`;
    if (page > 1) url += `?page=${page}`;
    return fetchAndParse(url);
}

async function loadChineseSubtitle(params) {
    const page = params.page || 1;
    let url = `${BASE_URL}/zh/genres/chinese-subtitle`;
    if (page > 1) url += `?page=${page}`;
    return fetchAndParse(url);
}

async function loadByGenre(params) {
    const page = params.page || 1;
    const genre = params.genre || "amateur";
    const sort = params.sort_by || "new";

    let url = `${BASE_URL}/zh/genres/${genre}`;
    const queryParts = [];
    if (sort && sort !== "new") queryParts.push(`sort=${sort}`);
    if (page > 1) queryParts.push(`page=${page}`);
    if (queryParts.length > 0) url += '?' + queryParts.join('&');

    return fetchAndParse(url);
}

// --- 详情加载 ---

async function loadDetail(link) {
    try {
        const response = await httpGetWithTimeout(link);
        const $ = Widget.html.load(response.data);

        // 1. 尝试从页面内 script 标签提取 m3u8 / mp4 地址
        let videoUrl = "";
        const scriptTexts = [];
        $('script').each((i, el) => {
            scriptTexts.push($(el).html() || "");
        });
        const allScripts = scriptTexts.join('\n');

        // MissAV 通常将播放地址放在类似 source = "..." 或 file: "..." 的 JS 变量中
        const patterns = [
            /source\s*=\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/,
            /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/,
            /src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/,
            /["'](https?:\/\/[^"']+\.m3u8[^"'"]+)['"]/,
            /source\s*=\s*["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/,
            /file\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/
        ];

        for (const pattern of patterns) {
            const match = allScripts.match(pattern);
            if (match) {
                videoUrl = match[1];
                break;
            }
        }

        // 2. 尝试 <video> 标签
        if (!videoUrl) {
            videoUrl = $('video source').attr('src') || $('video').attr('src') || "";
        }

        // 3. 尝试 og:video meta
        if (!videoUrl) {
            videoUrl = $('meta[property="og:video"]').attr('content') || "";
        }

        if (!videoUrl) {
            throw new Error("video_url_not_found");
        }

        videoUrl = videoUrl.replace(/&amp;/g, '&');

        const title = $('meta[property="og:title"]').attr('content')
            || $('h1').first().text().trim()
            || "标题未知";
        const desc = $('meta[property="og:description"]').attr('content')
            || $('[class*="description"], [class*="detail-description"]').first().text().trim()
            || "";
        const cover = $('meta[property="og:image"]').attr('content')
            || $('video').attr('poster')
            || "";

        // 解析推荐影片
        const childItems = [];
        $('a[href]').each((i, el) => {
            if (childItems.length >= 12) return false;

            const $a = $(el);
            const href = $a.attr('href') || "";
            if (!/\/(zh\/)?[a-zA-Z]+-\d+(\?.*)?$/.test(href)) return;
            if (href === link || href === link.replace(BASE_URL, '')) return;

            let recLink = href;
            if (!recLink.startsWith('http')) {
                recLink = BASE_URL + (recLink.startsWith('/') ? '' : '/') + recLink;
            }

            const $img = $a.find('img').first();
            let recPoster = normalizeImageUrl($img.attr('data-src') || $img.attr('src') || "");
            let recTitle = $img.attr('alt') || $a.text().trim() || "相关影片";

            if (recPoster && recTitle) {
                childItems.push({
                    id: recLink,
                    type: "url",
                    title: recTitle,
                    posterPath: recPoster,
                    backdropPath: recPoster,
                    mediaType: "movie",
                    link: recLink
                });
            }
        });

        return {
            id: link,
            type: "detail",
            videoUrl: videoUrl,
            title: title,
            description: desc,
            posterPath: normalizeImageUrl(cover),
            backdropPath: normalizeImageUrl(cover),
            mediaType: "movie",
            link: link,
            childItems: childItems,
            headers: getCommonHeaders()
        };

    } catch (error) {
        console.error("Detail load error:", error);
        let errorMsg = "无法加载视频，请重试。";
        if (error.message === "video_url_not_found") {
            errorMsg = "未找到视频地址，可能该视频需要登录或已失效。";
        }
        return {
            id: link,
            type: "detail",
            videoUrl: link,
            title: "加载失败",
            description: errorMsg,
            posterPath: "",
            mediaType: "movie",
            link: link
        };
    }
}
