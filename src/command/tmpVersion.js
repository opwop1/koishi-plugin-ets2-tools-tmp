const { segment } = require("koishi");
const { resolve } = require("path");
const common = require("../util/common");
const truckersMpApi = require("../api/truckersMpApi");
const messageRender = require("../util/messageRender");
const qqOfficial = require("../util/qqOfficial");

/**
 * 查询 TMP 当前版本。
 *
 * 输出形式由配置 tmpVersion.type 决定：1=文字，2=图片（默认）。
 * QQ 官方机器人下会自动附加按钮；onebot 行为与原版一致。
 */
module.exports = async (ctx, cfg, session) => {
    const type = messageRender.readType(cfg, 'tmpVersion.type');
    // 仅图片模式需要 puppeteer
    if (messageRender.wantImage(type) && !ctx.puppeteer) {
        return '未启用 Puppeteer 功能';
    }

    // 查询版本信息
    const result = await truckersMpApi.version(ctx.http);
    if (result.error || !result.data) {
        return '查询失败，请稍后再试';
    }

    const data = result.data;
    const text = buildVersionText(data);
    const buttons = buildButtons(session);

    return await messageRender.renderByType(ctx, session, cfg, 'tmpVersion.type', {
        text,
        buttons,
        caption: 'TruckersMP 当前版本',
        alt: 'TMP 版本',
        image: async () => {
            if (!ctx.puppeteer) return null;
            let page;
            try {
                const payload = {
                    name: data.name,
                    numeric: data.numeric,
                    stage: data.stage,
                    time: data.time,
                    ets: data.supported_game_version,
                    ats: data.supported_ats_game_version,
                };
                const htmlPath = resolve(__dirname, '../resource/tmp-version.html');

                page = await ctx.puppeteer.page();
                await page.setViewport({ width: 560, height: 700, deviceScaleFactor: 2 });
                await page.goto(`file:///${htmlPath}`);
                await page.evaluate(`setData(${JSON.stringify(payload)})`);
                await common.sleep(100);
                await page.waitForNetworkIdle();

                const element = await page.$("#container");
                if (!element) return null;
                return segment.image(await element.screenshot({ encoding: "binary" }), "image/jpeg");
            } catch (e) {
                ctx.logger.warn(`[tmp版本] 渲染失败，回退文字: ${e.message}`);
                return null;
            } finally {
                if (page) {
                    try { await page.close(); } catch { }
                }
            }
        }
    });
};

/** 文字版（图片渲染失败或配置为文字时使用） */
function buildVersionText(data) {
    return `TMP版本：${data.name}\n` +
        `欧卡支持版本: ${data.supported_game_version}\n` +
        `美卡支持版本: ${data.supported_ats_game_version}`;
}

/** 官方机器人下的快捷按钮 */
function buildButtons(session) {
    if (!qqOfficial.isQQOfficial(session)) return [];
    return [
        [qqOfficial.inputButton('刷新版本', 'tmp版本', true)],
        [qqOfficial.inputButton('欧卡服务器', '欧卡服务器'), qqOfficial.inputButton('规则查询', '规则查询')],
    ];
}
