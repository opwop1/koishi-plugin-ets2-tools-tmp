const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../util/common');
const evmOpenApi = require('../api/evmOpenApi');
const guildBind = require('../database/guildBind');
const tmpIdPicker = require('../util/tmpIdPicker');
module.exports = async (ctx, session, rankingType, target) => {
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
    // 支持 @别人 查询：拿对方的绑定来高亮（排行榜只高亮一个人）
    let ownerKey = session.userId;
    let ownerName = '';
    if (target && typeof target === 'string' && target.includes('<at ')) {
        const ats = tmpIdPicker.parseAt(target);
        const atUser = (Array.isArray(ats) && ats.length > 0) ? ats[0] : null;
        if (!atUser || !atUser.id) {
            return `无法识别@的用户`;
        }
        ownerKey = atUser.id;
        ownerName = atUser.name || '';
        if (ownerName) tmpIdPicker.cacheAtName(session.platform, ownerKey, ownerName);
    }
    // 排行榜只高亮一个人：直接用默认绑定，不弹序号询问
    const bindings = await guildBind.listOf(ctx.database, session.platform, ownerKey);
    let bindTmpId = null;
    if (bindings.length > 0) {
        await guildBind.ensureNames(ctx, bindings);
        bindTmpId = String((bindings.find(b => guildBind.isDefault(b)) || bindings[0]).tmp_id);
    }
    let playerMileageRanking = null;
    if (bindTmpId) {
        let playerMileageRankingResult = await evmOpenApi.mileageRankingList(ctx.http, rankingType, bindTmpId);
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
        await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 });
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
