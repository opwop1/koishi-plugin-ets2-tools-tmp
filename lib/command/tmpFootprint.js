const { segment } = require('koishi');
const dayjs = require('dayjs');
const { resolve } = require('path');
const common = require('../util/common');
const { ServerAliasToId, PromodsIds } = require('../util/constant');
const evmOpenApi = require('../api/evmOpenApi');
const guildBind = require('../database/guildBind');
module.exports = async (ctx, session, serverName) => {
    if (!ctx.puppeteer) {
        return '未启用 puppeteer 服务';
    }
    // 转换服务器别名到ID
    let serverId = ServerAliasToId[serverName];
    if (!serverId) {
        return '请输入正确的服务器名称 (s1, s2, p, a)';
    }
    // 尝试从数据库查询绑定信息
    let guildBindData = await guildBind.get(ctx.database, session.platform, session.userId);
    if (!guildBindData) {
        return `请先绑定玩家编号`;
    }
    let tmpId = guildBindData.tmp_id;
    // 查询玩家信息
    let playerInfo = await evmOpenApi.playerInfo(ctx.http, tmpId);
    if (playerInfo.error && playerInfo.code === 10001) {
        return '玩家不存在';
    }
    else if (playerInfo.error) {
        return '查询玩家信息失败，请重试';
    }
    // 查询当日历史位置数据
    const startTime = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const endTime = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
    let mapPlayerHistory = await evmOpenApi.mapPlayerHistory(ctx.http, tmpId, serverId, startTime, endTime);
    if (mapPlayerHistory.data.length === 0) {
        return `当日暂无数据`;
    }
    // 拼接数据
    let data = {
        mapType: PromodsIds.indexOf(serverId) !== -1 ? 'promods' : 'ets',
        name: playerInfo.data.name,
        smallAvatarUrl: playerInfo.data.smallAvatarUrl,
        todayMileage: playerInfo.data.todayMileage,
        points: mapPlayerHistory.data
    };
    let page;
    try {
        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 1000, height: 1000 });
        await page.goto(`file:///${resolve(__dirname, '../resource/footprint.html')}`);
        await page.evaluate(`init(${JSON.stringify(data)})`);
        await common.sleep(100);
        await page.waitForNetworkIdle();
        const element = await page.$("#container");
        return (segment.image(await element.screenshot({
            encoding: "binary"
        }), "image/jpg"));
    }
    catch (e) {
        return '渲染异常，请重试';
    }
    finally {
        if (page) {
            await page.close();
        }
    }
    return `OK: ` + playerInfo.data.name;
};
