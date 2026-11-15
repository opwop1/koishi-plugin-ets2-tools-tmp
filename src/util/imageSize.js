/**
 * 图片尺寸工具：为 markdown 图片语法提供精确的宽高。
 *
 * 背景（实测）：
 * QQ 官方 markdown 图片语法支持 `![alt #宽px #高px](url)`。
 * 如果只给宽度、不给高度，**手机端会自己算高度并拉伸图片**，导致比例失调。
 * 所以必须同时给出宽高，且要按截图元素的真实比例计算。
 *
 * 各模板截图元素的实际 CSS 尺寸并不等于视口宽度，例如：
 *   mileage-leaderboard.html → 元素 520×422（视口是 1000）
 *   tmp-version.html         → 元素 560×469
 * 所以不能写死，要从 DOM 读取。
 */

/** markdown 里允许的最大显示宽度（手机端友好） */
const MAX_WIDTH = 560;

/**
 * 各模板的推荐最大宽度（按设计稿原宽，实测 DOM 得到）。
 *
 * 说明：这些值等于模板里 #container 的真实 CSS 宽度，
 * 用它作为上限可以「只缩小不放大」，避免图片被拉大导致模糊。
 * 超过 MAX_WIDTH 的模板（如 tmpVtcOnline 760、dlc 600）统一压到 560，
 * 因为手机屏幕放不下更宽。
 */
const TEMPLATE_MAX_WIDTH = {
    'mileage-leaderboard.html': 520,
    'point-leaderboard.html': 520,
    'tmp-version.html': 560,
    'command-suggest.html': 560,
    'server-list.html': 480,
    'query.html': 480,
    'tmpVtcOnline.html': 560,   // 原 760，压到 560 适配手机
    'dlc.html': 560,            // 原 600，压到 560
    'traffic.html': 560,
    'footprint.html': 560,
    'position.html': 560,
    'version-update.html': 560,
};

/**
 * 按「元素真实尺寸」计算 markdown 显示尺寸。
 * 只缩小不放大（避免模糊），并保持宽高比。
 *
 * @param {number} cssWidth 元素 CSS 宽度
 * @param {number} cssHeight 元素 CSS 高度
 * @param {number} [maxWidth] 最大显示宽度
 * @returns {{width: number, height: number}}
 */
function fitSize(cssWidth, cssHeight, maxWidth) {
    const w = Number(cssWidth);
    const h = Number(cssHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return { width: 0, height: 0 };
    }
    const limit = Number(maxWidth) > 0 ? Number(maxWidth) : MAX_WIDTH;
    // 只缩小不放大：原图比 limit 窄就保持原样
    const targetWidth = Math.min(Math.round(w), limit);
    const targetHeight = Math.max(1, Math.round(h * (targetWidth / w)));
    return { width: targetWidth, height: targetHeight };
}

/**
 * 在 puppeteer 页面里测量元素的 CSS 尺寸。
 *
 * @param {object} page puppeteer page
 * @param {string} [selector] 元素选择器，默认 #container
 * @returns {Promise<{width: number, height: number}|null>}
 */
async function measureElement(page, selector) {
    const sel = selector || '#container';
    try {
        const box = await page.evaluate((s) => {
            const el = document.querySelector(s);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { width: Math.round(r.width), height: Math.round(r.height) };
        }, sel);
        return box;
    } catch {
        return null;
    }
}

/**
 * 计算某个模板的 markdown 尺寸（结合模板的推荐宽度）。
 *
 * @param {string} templateFile 模板文件名，用于取推荐宽度
 * @param {number} cssWidth
 * @param {number} cssHeight
 */
function fitForTemplate(templateFile, cssWidth, cssHeight) {
    const limit = TEMPLATE_MAX_WIDTH[templateFile] || MAX_WIDTH;
    return fitSize(cssWidth, cssHeight, limit);
}

/**
 * 截图并把真实尺寸挂到图片元素的 attrs 上。
 *
 * 这样图片元素在被层层传递（tmpQuery → messageRender）后，
 * 尺寸信息仍然可用，markdown 里就能写出精确的 `#宽px #高px`，避免手机端拉伸变形。
 *
 * @param {object} page puppeteer page
 * @param {object} segment koishi 的 segment 工具（用于构造图片元素）
 * @param {string} [templateFile] 模板文件名（用于取推荐最大宽度）
 * @param {string} [selector] 元素选择器，默认 #container
 * @returns {Promise<object|null>} 带尺寸属性的图片元素；失败返回 null
 */
async function screenshotWithSize(page, segment, templateFile, selector) {
    const sel = selector || '#container';
    const element = await page.$(sel);
    if (!element) return null;
    const box = await measureElement(page, sel);
    const buf = await element.screenshot({ encoding: 'binary' });
    const img = segment.image(buf, 'image/jpeg');
    if (box && img && img.attrs) {
        const size = templateFile ? fitForTemplate(templateFile, box.width, box.height) : fitSize(box.width, box.height);
        img.attrs.width = size.width;
        img.attrs.height = size.height;
    }
    return img;
}

module.exports = {
    MAX_WIDTH,
    TEMPLATE_MAX_WIDTH,
    fitSize,
    fitForTemplate,
    measureElement,
    screenshotWithSize,
};
