const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../util/common');
const evmOpenApi = require('../api/evmOpenApi');
const guildBind = require('../database/guildBind');
module.exports = async (ctx, session, rankingType) => {
    if (!ctx.puppeteer) {
        return '未启用 Puppeteer 功能';
    }
    // 查询排行榜信息
    let mileageRankingList = await evmOpenApi.mileageRankingList(ctx.http, rankingType, null);
    if (mileageRankingList.error) {
        return '查询排行榜信息失败';
    }
    else if (mileageRankingList.data.length === 0) {
        return '暂无数据';
    }
    // 查询当前玩家的排行信息
    let guildBindData = await guildBind.get(ctx.database, session.platform, session.userId);
    let playerMileageRanking = null;
    if (guildBindData) {
        let playerMileageRankingResult = await evmOpenApi.mileageRankingList(ctx.http, rankingType, guildBindData.tmp_id);
        if (!playerMileageRankingResult.error && playerMileageRankingResult.data.length > 0) {
            playerMileageRanking = playerMileageRankingResult.data[0];
        }
    }
    // 拼接页面数据
    let data = {
        rankingType: rankingType,
        mileageRankingList: mileageRankingList.data,
        playerMileageRanking: playerMileageRanking
    };
    let page;
    try {
        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 1000, height: 1000 });
        await page.goto(`file:///${resolve(__dirname, '../resource/mileage-leaderboard.html')}`);
        await page.evaluate(`setData(${JSON.stringify(data)})`);
        await page.waitForNetworkIdle();
        await common.sleep(500);
        const element = await page.$("#container");
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
