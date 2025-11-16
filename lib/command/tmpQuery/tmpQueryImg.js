const dayjs = require('dayjs');
const guildBind = require('../../database/guildBind');
const truckyAppApi = require('../../api/truckyAppApi');
const evmOpenApi = require('../../api/evmOpenApi');
const baiduTranslate = require('../../util/baiduTranslate');
const { resolve } = require("path");
const common = require("../../util/common");
const { segment } = require("koishi");
/**
 * 用户组
 */
const userGroup = {
    'Player': '玩家',
    'Retired Legend': '退役',
    'Game Developer': '游戏开发者',
    'Retired Team Member': '退休团队成员',
    'Add-On Team': '附加组件团队',
    'Game Moderator': '游戏管理员'
};
/**
 * 查询玩家信息
 */
module.exports = async (ctx, cfg, session, tmpId) => {
    if (!ctx.puppeteer) {
        return '未启用 puppeteer 服务';
    }
    if (tmpId && isNaN(tmpId)) {
        return `请输入正确的玩家编号`;
    }
    // 如果没有传入tmpId，尝试从数据库查询绑定信息
    if (!tmpId) {
        let guildBindData = await guildBind.get(ctx.database, session.platform, session.userId);
        if (!guildBindData) {
            return `请输入正确的玩家编号`;
        }
        tmpId = guildBindData.tmp_id;
    }
    // 查询玩家信息
    let playerInfo = await evmOpenApi.playerInfo(ctx.http, tmpId);
    if (playerInfo.error && playerInfo.code === 10001) {
        return '玩家不存在';
    }
    else if (playerInfo.error) {
        return '查询玩家信息失败，请重试';
    }
    // 查询线上信息
    let playerMapInfo = await truckyAppApi.online(ctx.http, tmpId);
    // 拼接数据
    let data = {};
    data.tmpId = playerInfo.data.tmpId;
    data.name = playerInfo.data.name;
    data.steamId = playerInfo.data.steamId;
    data.registerDate = dayjs(playerInfo.data.registerTime).format('YYYY年MM月DD日');
    data.avatarUrl = playerInfo.data.avatarUrl;
    data.groupColor = playerInfo.data.groupColor;
    data.groupName = (userGroup[playerInfo.data.groupName] || playerInfo.data.groupName);
    data.isJoinVtc = playerInfo.data.isJoinVtc;
    data.vtcName = playerInfo.data.vtcName;
    data.vtcRole = playerInfo.data.vtcRole;
    data.isSponsor = playerInfo.data.isSponsor;
    data.sponsorAmount = playerInfo.data.sponsorAmount;
    data.sponsorCumulativeAmount = playerInfo.data.sponsorCumulativeAmount;
    data.sponsorHide = playerInfo.data.sponsorHide;
    data.isOnline = false;
    if (playerMapInfo && !playerMapInfo.error) {
        data.isOnline = playerMapInfo.data.online;
        if (data.isOnline) {
            data.onlineServerName = playerMapInfo.data.serverDetails.name;
            data.onlineCountry = await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.country);
            data.onlineCity = await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.realName);
            data.onlineX = playerMapInfo.data.x;
            data.onlineY = playerMapInfo.data.y;
            data.onlineMapType = playerMapInfo.data.serverDetails.id === 50 ? 'promods' : 'ets';
        }
    }
    data.isBan = playerInfo.data.isBan;
    data.banUntil = playerInfo.data.banUntil;
    data.banReason = playerInfo.data.banReason;
    data.banReasonZh = playerInfo.data.banReasonZh;
    data.banCount = playerInfo.data.banCount;
    data.banHide = playerInfo.data.banHide;
    let page;
    try {
        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 1000, height: 1000 });
        await page.goto(`file:///${resolve(__dirname, '../../resource/query.html')}`);
        await page.evaluate(`init(${JSON.stringify(data)})`);
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
