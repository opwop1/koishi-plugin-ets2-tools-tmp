const evmOpenApi = require('../../api/evmOpenApi');
const { resolve } = require("path");
const common = require("../../util/common");
const imageSizeUtil = require('../../util/imageSize');
const { segment } = require("koishi");
module.exports = async (ctx, game) => {
    if (!ctx.puppeteer) {
        return '未启用 puppeteer 服务';
    }
    // 查询服务器信息
    let serverData = await evmOpenApi.serverList(ctx.http, game);
    if (serverData.error) {
        return '查询服务器失败，请稍后重试';
    }
    let page;
    try {
        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 380, height: 1000, deviceScaleFactor: 1.5 });
        await page.goto(`file:///${resolve(__dirname, '../../resource/server-list.html')}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.evaluate(`setData(${JSON.stringify({ ...serverData, game })})`);
        await common.sleep(100);
        await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => { });
        return await imageSizeUtil.screenshotWithSize(page, segment, 'server-list.html');
    }
    catch (error) {
            ctx.logger.error(`[渲染] command/tmpServer/tmpServerImg.js 失败: ${error && error.message || error}`, error && error.stack ? error.stack : '');
            return '渲染异常，请重试';
    }
    finally {
        if (page) {
            await page.close();
        }
    }
};
