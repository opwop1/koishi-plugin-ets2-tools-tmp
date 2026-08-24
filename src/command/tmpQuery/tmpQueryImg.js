const dayjs = require('dayjs');
const dayjsRelativeTime = require('dayjs/plugin/relativeTime');
const dayjsLocaleZhCn = require('dayjs/locale/zh-cn');
const guildBind = require('../../database/guildBind');
const truckyAppApi = require('../../api/truckyAppApi');
const evmOpenApi = require('../../api/evmOpenApi');
const baiduTranslate = require('../../util/baiduTranslate');
const { resolve } = require("path");
const common = require("../../util/common");
const { segment } = require("koishi");
dayjs.extend(dayjsRelativeTime);
dayjs.locale(dayjsLocaleZhCn);
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
    const { vtcId } = cfg.tmpActivityService?.api || {};
    if (!ctx.puppeteer) {
        return '未启用 puppeteer 服务';
    }
    if (tmpId && tmpId.startsWith("<at ")) {
        let queryQQ = tmpId.replace('<at ', '');
        let id = '';
        const idStart = queryQQ.indexOf('id="');
        if (idStart !== -1) {
            const valueStart = idStart + 4;
            const valueEnd = queryQQ.indexOf('"', valueStart);
            if (valueEnd !== -1) {
                id = queryQQ.substring(valueStart, valueEnd);
            }
        }
        queryQQ = id;
        let guildBindData = await guildBind.get(ctx.database, session.platform, queryQQ);
        if (!guildBindData) {
            return `该用户没有绑定玩家编号`;
        }
        tmpId = guildBindData.tmp_id;
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
    data.showAvatar = cfg.tmpQuery?.showAvatar !== false;
    data.tmpId = playerInfo.data.tmpId;
    data.name = playerInfo.data.name;
    data.steamId = playerInfo.data.steamId;
    let registerDate = dayjs(playerInfo.data.registerTime);
    data.registerDate = registerDate.format('YYYY年MM月DD日');
    data.registerDays = dayjs().diff(registerDate, 'day');
    data.avatarUrl = playerInfo.data.avatarUrl;
    data.groupColor = playerInfo.data.groupColor;
    data.groupName = (userGroup[playerInfo.data.groupName] || playerInfo.data.groupName);
    data.isJoinVtc = playerInfo.data.isJoinVtc;
    data.vtcName = playerInfo.data.vtcName;
    data.vtcRole = playerInfo.data.vtcRole;
    data.vtcHistory = playerInfo.data.vtcHistory || [];
    data.isSponsor = playerInfo.data.isSponsor;
    data.sponsorAmount = playerInfo.data.sponsorAmount;
    data.sponsorCumulativeAmount = playerInfo.data.sponsorCumulativeAmount;
    data.sponsorHide = playerInfo.data.sponsorHide;
    data.mileage = playerInfo.data.mileage;
    data.todayMileage = playerInfo.data.todayMileage;
    data.isOnline = false;
    data.onlineStatus = '离线';
    if (playerMapInfo && !playerMapInfo.error) {
        data.isOnline = playerMapInfo.data.online;
        if (data.isOnline) {
            data.onlineStatus = '在线';
            data.onlineServerName = playerMapInfo.data.serverDetails.name;
            data.onlineCountry = await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.country);
            data.onlineCity = await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.realName);
            data.onlineX = playerMapInfo.data.x;
            data.onlineY = playerMapInfo.data.y;
            data.onlineMapType = playerMapInfo.data.serverDetails.id === 50 ? 'promods' : 'ets';
        } else if (playerInfo.data.lastOnlineTime) {
            data.lastOnlineTime = dayjs(playerInfo.data.lastOnlineTime).fromNow(false);
        }
    }
    data.isBan = playerInfo.data.isBan;
    data.banUntil = playerInfo.data.banUntil;
    data.banReason = playerInfo.data.banReason;
    data.banReasonZh = playerInfo.data.banReasonZh;
    data.banCount = playerInfo.data.banCount;
    data.banHide = playerInfo.data.banHide;
    // 查询VTC积分（仅主群/管理群显示）
    data.rewardPoints = 0;
    if (playerInfo.data.isJoinVtc && cfg.commands?.mainSettings) {
        const mainGroups = cfg.tmpActivityService?.mainGroup?.groups || [];
        const adminGroups = cfg.tmpActivityService?.admin?.groups || [];
        const allowedGroups = [...new Set([...mainGroups, ...adminGroups])];
        const currentGroupId = session.channelId || '';
        const isInAllowedGroup = allowedGroups.some(g => currentGroupId.includes(g));

        if (isInAllowedGroup && playerInfo.data.vtcId == vtcId) {
            const { url, token, logOutput, platformVersion } = cfg.mainSettings?.settings || {};
            const platform = (platformVersion || "v1").toLowerCase();
            try {
                if (platform === "v2") {
                    const baseUrl = url;
                    const userInfoUrl = `https://${baseUrl}/members/get?token=${token}&tmpId=${tmpId}`;
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] tmpQueryImg：开始查询TmpID ${tmpId} 的V2.0积分`);
                        ctx.logger.info(`[TMP_BOT] 请求V2.0用户信息: ${userInfoUrl}`);
                    }
                    const userInfoResponse = await ctx.http.get(userInfoUrl);
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] V2.0用户信息响应: ${JSON.stringify(userInfoResponse)}`);
                    }
                    if (userInfoResponse.code === 200 && userInfoResponse.data) {
                        data.rewardPoints = userInfoResponse.data.point || 0;
                    }
                } else {
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] tmpQueryImg：开始查询TmpID ${tmpId} 的V1.0积分`);
                    }
                    const userInfoUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=7&tmpId=${tmpId}&tmpName=&teamId=&qq=&state=0&teamRole=`;
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] 请求V1.0用户信息: ${userInfoUrl}`);
                    }
                    const userInfoResponse = await ctx.http.post(userInfoUrl);
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] V1.0用户信息响应: ${JSON.stringify(userInfoResponse)}`);
                    }
                    const userList = userInfoResponse.page?.list || [];
                    const userInfo = userList[0];
                    data.rewardPoints = userInfo.rewardPoints || 0;
                }
            } catch (error) {
                ctx.logger.error(`积分查询过程出错: ${error}`);
            }
        }
    }
    // 查询Steam游戏时长
    data.ets2GameTime = null;
    data.atsGameTime = null;
    if (cfg.commands?.tmpQueryGameTime) {
        try {
            const steamApiKey = cfg.steamApi?.key;
            if (steamApiKey) {
                const steamId = playerInfo.data.steamId;
                const url = `https://evmapi.cxnnn.cn/proxy/steam/IPlayerService/GetOwnedGames/v1?key=${steamApiKey}&steamid=${steamId}&appids_filter[0]=227300&appids_filter[1]=270880&include_played_free_games=1`;
                const response = await ctx.http.get(url);
                if (response.response && response.response.game_count > 0) {
                    for (const game of response.response.games) {
                        const playtimeMinutes = game.playtime_forever;
                        const hours = Math.floor(playtimeMinutes / 60);
                        const minutes = playtimeMinutes % 60;
                        const playtime = `${hours}小时${minutes}分钟`;
                        if (game.appid === 227300) {
                            data.ets2GameTime = playtime;
                        } else if (game.appid === 270880) {
                            data.atsGameTime = playtime;
                        }
                    }
                }
            }
        } catch (error) {
            ctx.logger.error(`查询Steam游戏时长出错: ${error}`);
        }
    }
    let page;
    try {
        page = await ctx.puppeteer.page();
        await page.setViewport({ width: 520, height: 1000 });
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
