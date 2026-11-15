const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../util/common');
const imageSizeUtil = require('../util/imageSize');
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
        await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 });
        await page.goto(`file:///${resolve(__dirname, '../resource/dlc.html')}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.evaluate(`setData(${JSON.stringify(dlcData.data)})`);
        await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => { });
        await common.sleep(500);
        const element = await page.$("#dlc-info-container");
        if (!element) throw new Error('未找到容器元素（模板可能未加载完成）');
        // 把真实尺寸挂到元素上，markdown 才能写出精确宽高（否则手机端拉伸变形）
        const box = await imageSizeUtil.measureElement(page, '#dlc-info-container');
        const img = segment.image(await element.screenshot({
            encoding: "binary"
        }), "image/jpeg");
        if (box && img && img.attrs) {
            const size = imageSizeUtil.fitForTemplate('dlc.html', box.width, box.height);
            img.attrs.width = size.width;
            img.attrs.height = size.height;
        }
        return img;
    }
    catch (e) {
        ctx.logger.error(`[渲染] command/tmpDlcMap.js 失败: ${e && e.message || e}`, e && e.stack ? e.stack : '');
        return '渲染异常，请重试';
    }
    finally {
        if (page) {
            await page.close();
        }
    }
};
