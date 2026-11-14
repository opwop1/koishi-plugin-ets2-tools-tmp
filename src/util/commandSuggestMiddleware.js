/**
 * 「猜你想问」中间件：用户指令打错时给出提示。
 *
 * 只提示 + 给可点按钮，不自动执行 —— 避免误操作。
 *
 * 两种输入都要支持：
 * - 带前缀：`.vtc里程排行` / `/vtc里程排行`
 * - 不带前缀：`vtc里程排行`（QQ 机器人用户很少加前缀）
 *
 * 误伤防护：
 * - 只在「首词能匹配到插件指令」时才介入，普通聊天一律放行；
 * - 已存在的有效指令一律放行；
 * - 人工回复的序号（纯数字）放行。
 */

const { suggestCommands, normalizeCommandText, levenshtein } = require('./commandSuggest');
const qqOfficial = require('./qqOfficial');
const messageRender = require('./messageRender');

const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('./common');

/** 去掉指令前缀（. / # ! 等）后取首词 */
function firstToken(raw) {
    return String(raw == null ? '' : raw)
        .trim()
        .replace(/^[./#!]+/, '')
        .split(/\s+/)[0] || '';
}

/**
 * 从 session 里取出「用户输入的指令名」。
 *
 * @returns {string|null} 不是疑似指令时返回 null
 */
function extractCommandText(session) {
    // 已经被 Koishi 解析成有效命令 → 不需要纠错
    if (session.argv && session.argv.command) return null;

    const raw = String(session.content || '').trim();
    if (!raw) return null;

    // 纯数字（正在回复序号）不处理
    if (/^\d+$/.test(raw)) return null;

    // @ 开头的（纯 @ 某人）不处理
    if (raw.startsWith('<at ')) return null;

    const text = normalizeCommandText(firstToken(raw));
    if (!text) return null;

    // 太短的不纠错（如「查」「a」），避免误伤
    if (text.length < 2) return null;

    return text;
}

/**
 * 判断这条消息是否「看起来像在调用插件指令」。
 * 用于避免把普通聊天当成打错的指令。
 *
 * 判断依据必须与 suggestCommands 一致（真正的编辑距离），
 * 否则会出现「积分排行」这种正确指令被误判成"打错"的情况。
 */
function looksLikeCommand(text, candidates, maxDistance) {
    if (!text) return false;

    // 先扫一遍：只要命中任何一条真实指令，就认为这是正确输入，不纠错
    for (const name of candidates) {
        const target = normalizeCommandText(name);
        if (target && target === text) return false;
    }

    for (const name of candidates) {
        const target = normalizeCommandText(name);
        if (!target) continue;

        // 与实际建议逻辑保持完全一致
        const distance = levenshtein(text, target, maxDistance);
        if (distance <= maxDistance) return true;

        // 前缀关系（少打字 / 多打字）
        if (target.length > text.length && target.startsWith(text) && text.length >= 2) return true;
        if (text.length > target.length && text.startsWith(target) && target.length >= 2) return true;
    }
    return false;
}

/**
 * 注册中间件。
 * @param {object} ctx koishi context
 * @param {object} cfg 插件配置
 * @param {string[]} candidates 已知指令名列表
 */
function register(ctx, cfg, candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return;
    if (cfg.commandSuggest && cfg.commandSuggest.enable === false) return;

    // 与 suggestCommands 保持一致的阈值
    const cfgMax = cfg.commandSuggest && cfg.commandSuggest.maxDistance;
    const fixedMax = (cfgMax != null && Number(cfgMax) > 0) ? Number(cfgMax) : null;

    ctx.middleware(async (session, next) => {
        try {
            const input = extractCommandText(session);
            if (!input) return next();

            // 已经是有效指令 → 放行
            const commander = ctx.$commander;
            if (commander && commander.get && commander.get(input)) return next();

            // 粗筛：不像指令的普通聊天直接放行
            const maxDistance = fixedMax != null ? fixedMax : (input.length <= 3 ? 1 : 2);
            if (!looksLikeCommand(input, candidates, maxDistance)) return next();

            const suggestOpts = { limit: 3 };
            if (fixedMax != null) suggestOpts.maxDistance = fixedMax;

            const suggestions = suggestCommands(input, candidates, suggestOpts);
            if (suggestions.length === 0) return next();

            const names = suggestions.map(s => s.name);
            const text = buildSuggestionText(names);
            const buttons = buildSuggestionButtons(names);

            // 图片模式（配置 type=2）：用 puppeteer 渲染一张提示图
            const type = cfg.commandSuggest && cfg.commandSuggest.type;
            if (Number(type) === 2 && ctx.puppeteer) {
                const image = await renderSuggestionImage(ctx, names, input);
                if (image) {
                    return await messageRender.renderImage(session, image, {
                        buttons,
                        uploader: await messageRender.buildUploader(ctx, cfg, session),
                    });
                }
            }

            return await messageRender.renderText(session, text, {
                buttons,
                markdown: true,
            });
        } catch (error) {
            ctx.logger.warn(`[猜你想问] 处理失败: ${error.message}`);
            return next();
        }
    }, true);   // prepend：放在较前位置，但内部对有效指令一律 next()
}

/**
 * 组装提示文案。
 */
function buildSuggestionText(names) {
    if (names.length === 1) {
        return `猜你想问：${names[0]}？`;
    }
    const list = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
    return `猜你想问：\n${list}`;
}

/**
 * 组装可点按钮（仅官方机器人有效，onebot 会被自动忽略）。
 * 一行一个，避免手机端文字被压成省略号。
 */
function buildSuggestionButtons(names) {
    return names.map(name => [qqOfficial.inputButton(name, name, true)]);
}

/**
 * 渲染「猜你想问」提示图。
 * @returns {Promise<object|null>} 图片元素；渲染不可用/失败时返回 null（调用方回退文字）
 */
async function renderSuggestionImage(ctx, names, input) {
    if (!ctx.puppeteer) {
        ctx.logger.debug("[猜你想问] 未启用 puppeteer，回退为文字提示");
        return null;
    }
    let page;
    try {
        const data = { names, input: input || '' };
        const htmlPath = resolve(__dirname, '../resource/command-suggest.html');

        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 560, height: 400, deviceScaleFactor: 2 });
        await page.goto(`file:///${htmlPath}`);
        await page.evaluate(`setData(${JSON.stringify(data)})`);
        await common.sleep(100);
        await page.waitForNetworkIdle();

        const element = await page.$("#container");
        if (!element) throw new Error("未找到 #container");
        return segment.image(await element.screenshot({ encoding: "binary" }), "image/jpeg");
    } catch (error) {
        ctx.logger.warn(`[猜你想问] 渲染提示图失败，回退为文字: ${error.message}`);
        return null;
    } finally {
        if (page) {
            try { await page.close(); } catch { }
        }
    }
}

module.exports = {
    register,
    extractCommandText,
    looksLikeCommand,
    buildSuggestionText,
    buildSuggestionButtons,
    renderSuggestionImage,
};
