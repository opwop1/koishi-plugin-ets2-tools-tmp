const evmOpenApi = require('../../api/evmOpenApi');
const { resolve } = require("path");
const common = require("../../util/common");
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
        await page.goto(`file:///${resolve(__dirname, '../../resource/server-list.html')}`);
        await page.evaluate(`setData(${JSON.stringify({ ...serverData, game })})`);
        await common.sleep(100);
        await page.waitForNetworkIdle();
        const element = await page.$("#container");
        return (segment.image(await element.screenshot({
            encoding: "binary"
        }), "image/jpg"));
    }
    catch {
        return '渲染异常，请重试';
    }
    finally {
        if (page) {
            await page.close();
        }
    }
};
