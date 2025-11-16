const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../util/common');
const evmOpenApi = require('../api/evmOpenApi');
module.exports = async (ctx, session) => {
    if (!ctx.puppeteer) {
        return '未启用 Puppeteer 功能';
    }
    // 查询DLC数据
    let dlcData = await evmOpenApi.dlcList(ctx.http, 1);
    let page;
    try {
        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 1000, height: 1000 });
        await page.goto(`file:///${resolve(__dirname, '../resource/dlc.html')}`);
        await page.evaluate(`setData(${JSON.stringify(dlcData.data)})`);
        await page.waitForNetworkIdle();
        await common.sleep(500);
        const element = await page.$("#dlc-info-container");
        return (segment.image(await element.screenshot({
            encoding: "binary"
        }), "image/jpg"));
    }
    catch (e) {
        console.info(e);
        return '渲染异常，请重试';
    }
    finally {
        if (page) {
            await page.close();
        }
    }
};
