/**
 * 瓦片地图参数：从服务器上的 TileMapInfo.json 实时计算坐标换算参数。
 *
 * 背景：
 * 每次导出瓦片地图时都会带上 TileMapInfo.json（记录该地图的坐标范围）：
 *   { x1, x2, y1, y2, minZoom, maxZoom }
 * 它和瓦片在同一目录，例如：
 *   https://ets_tiles.114512.xyz/20260903/tmp-ets-yellow/Tiles/{z}/{x}/{y}.png
 *   https://ets_tiles.114512.xyz/20260903/tmp-ets-yellow/TileMapInfo.json
 *
 * 坐标换算（Leaflet Simple CRS，zoom 8 时共 2^8 × 2^8 个 512px 瓦片）：
 *   totalPx = 2^maxZoom × tileSize
 *   scale   = (x2 - x1) / totalPx        // 游戏单位 → 地图像素
 *   offsetX = -x1 / scale                // 让 x1 映射到 0
 *   mapX    = gameX / scale + offsetX
 *
 * 这样以后更新地图只需上传新的 TileMapInfo.json，**不用改代码**。
 */

/** Leaflet 瓦片尺寸（与模板里 tileSize 一致） */
const TILE_SIZE = 512;

/** 参数缓存时长：避免每次渲染都请求（地图不常变） */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** 缓存：url → { at, value } */
const cache = new Map();

/**
 * 由 TileMapInfo 计算坐标换算参数。
 *
 * @param {{x1:number,x2:number,y1:number,y2:number,maxZoom:number}} info
 * @returns {{scale:number, offsetX:number, offsetY:number, maxZoom:number, minZoom:number,
 *            spanX:number, spanY:number, totalPx:number}|null}
 */
function computeParams(info) {
    if (!info) return null;
    const x1 = Number(info.x1);
    const x2 = Number(info.x2);
    const y1 = Number(info.y1);
    const y2 = Number(info.y2);
    if (![x1, x2, y1, y2].every(Number.isFinite)) return null;

    const spanX = x2 - x1;
    const spanY = y2 - y1;
    if (spanX <= 0 || spanY <= 0) return null;

    const maxZoom = Number.isFinite(Number(info.maxZoom)) ? Number(info.maxZoom) : 8;
    const minZoom = Number.isFinite(Number(info.minZoom)) ? Number(info.minZoom) : 2;
    const totalPx = Math.pow(2, maxZoom) * TILE_SIZE;

    // X / Y 分开算，允许非等比（通常一致）
    const scaleX = spanX / totalPx;
    const scaleY = spanY / totalPx;

    return {
        scale: scaleX,
        scaleY,
        offsetX: -x1 / scaleX,
        offsetY: -y1 / scaleY,
        maxZoom,
        minZoom,
        spanX,
        spanY,
        totalPx,
    };
}

/**
 * 把瓦片 URL 转成 TileMapInfo.json 的 URL。
 * 例如 .../tmp-ets-yellow/Tiles/{z}/{x}/{y}.png → .../tmp-ets-yellow/TileMapInfo.json
 */
function tileUrlToInfoUrl(tileUrl) {
    if (!tileUrl) return null;
    const s = String(tileUrl);
    // 去掉末尾的 /Tiles/{z}/{x}/{y}.png（或任意层级）
    const idx = s.indexOf('/Tiles/');
    if (idx === -1) return null;
    return `${s.slice(0, idx)}/TileMapInfo.json`;
}

/**
 * 拉取并解析某个瓦片目录的 TileMapInfo.json（带缓存）。
 *
 * @param {object} http koishi 的 ctx.http
 * @param {string} tileUrl 瓦片模板 URL
 * @param {object} [logger] 可选日志
 * @returns {Promise<object|null>} 计算好的参数；失败返回 null（调用方回退到内置参数）
 */
async function fetchParams(http, tileUrl, logger) {
    const infoUrl = tileUrlToInfoUrl(tileUrl);
    if (!infoUrl) return null;

    const now = Date.now();
    const hit = cache.get(infoUrl);
    if (hit && now - hit.at < CACHE_TTL_MS) {
        return hit.value;
    }

    try {
        const resp = await http.get(infoUrl, { timeout: 10000 });
        // 兼容两种返回：直接 JSON，或 {data: JSON}
        const info = resp && resp.data && typeof resp.data === 'object' && !('x1' in resp)
            ? resp.data
            : resp;
        const params = computeParams(info);
        if (!params) {
            if (logger) logger.warn(`[瓦片参数] ${infoUrl} 内容无效: ${JSON.stringify(resp).slice(0, 120)}`);
            cache.set(infoUrl, { at: now, value: null });
            return null;
        }
        cache.set(infoUrl, { at: now, value: params });
        if (logger) {
            logger.debug(`[瓦片参数] ${infoUrl} → scale=${params.scale.toFixed(6)} `
                + `offset=(${params.offsetX.toFixed(2)}, ${params.offsetY.toFixed(2)}) maxZoom=${params.maxZoom}`);
        }
        return params;
    } catch (error) {
        if (logger) logger.warn(`[瓦片参数] 拉取 ${infoUrl} 失败: ${error.message}（将使用内置参数）`);
        // 失败也缓存一段时间，避免每次渲染都重试
        cache.set(infoUrl, { at: now, value: null });
        return null;
    }
}

/**
 * 批量拉取多个地图的参数。
 *
 * @param {object} http
 * @param {Record<string,string>} tileUrls 形如 { ets: 'https://.../Tiles/{z}/{x}/{y}.png', ... }
 * @param {object} [logger]
 * @returns {Promise<Record<string, object|null>>}
 */
async function fetchAll(http, tileUrls, logger) {
    const entries = Object.entries(tileUrls || {});
    const results = await Promise.all(entries.map(async ([key, url]) => {
        const p = await fetchParams(http, url, logger);
        return [key, p];
    }));
    return Object.fromEntries(results);
}

/** 清空缓存（测试用） */
function clearCache() {
    cache.clear();
}

/**
 * 为模板数据附加 tileParams（供 setData/init 使用）。
 *
 * 用法：const data = await attachTo(ctx, { mapType:'ets', ... }, { ets:'https://.../Tiles/{z}/{x}/{y}.png' });
 *
 * @param {object} ctx koishi context（需要 ctx.http）
 * @param {object} data 模板数据对象（会被就地修改）
 * @param {Record<string,string>} tileUrls 各地图的瓦片 URL
 * @returns {Promise<object>} 同一个 data 对象
 */
async function attachTo(ctx, data, tileUrls) {
    if (!ctx || !ctx.http || !data) return data;
    try {
        const params = await fetchAll(ctx.http, tileUrls, ctx.logger);
        // 只把成功拿到的放进 tileParams
        const valid = {};
        for (const [k, v] of Object.entries(params)) {
            if (v) valid[k] = v;
        }
        if (Object.keys(valid).length > 0) {
            data.tileParams = valid;
        }
    } catch (error) {
        if (ctx.logger) ctx.logger.warn(`[瓦片参数] 附加失败: ${error.message}`);
    }
    return data;
}

module.exports = {
    TILE_SIZE,
    CACHE_TTL_MS,
    computeParams,
    tileUrlToInfoUrl,
    fetchParams,
    fetchAll,
    clearCache,
    attachTo,
};
