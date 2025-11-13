const dayjs = require('dayjs');
const dayjsRelativeTime = require('dayjs/plugin/relativeTime');
const dayjsLocaleZhCn = require('dayjs/locale/zh-cn');
const guildBind = require('../../database/guildBind');
const truckyAppApi = require('../../api/truckyAppApi');
const evmOpenApi = require('../../api/evmOpenApi');
const baiduTranslate = require('../../util/baiduTranslate');
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
    // if (tmpId && isNaN(tmpId)) {
    //     return `请输入正确的玩家编号`;
    // }
    if (tmpId && tmpId.startsWith("<at ")) {
        if (tmpId.startsWith('<at ')) {
            queryQQ = tmpId.replace('<at ', '');
        }
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
    // 拼接消息模板
    let message = '';
    if (cfg.queryShowAvatarEnable) {
        message += `<img src="${playerInfo.data.avatarUrl}"/>\n`;
    }
    message += '🆔TMP编号: ' + playerInfo.data.tmpId;
    message += '\n😀玩家名称: ' + playerInfo.data.name;
    message += '\n🎮SteamID: ' + playerInfo.data.steamId;
    let registerDate = dayjs(playerInfo.data.registerTime);
    message += '\n📑注册日期: ' + registerDate.format('YYYY年MM月DD日') + ` (${dayjs().diff(registerDate, 'day')}天)`;
    message += '\n💼所属分组: ' + (userGroup[playerInfo.data.groupName] || playerInfo.data.groupName);
    if (playerInfo.data.isJoinVtc) {
        message += '\n🚚所属车队: ' + playerInfo.data.vtcName;
        if (playerInfo.data.vtcHistory && playerInfo.data.vtcHistory.length > 0) {
            message += `\n📜历史车队:\n${playerInfo.data.vtcHistory.map(vtc => `- ${vtc.vtcName}\n(加入时间: ${dayjs(vtc.joinDate).format('YYYY年MM月DD日')}, 离开日期: ${dayjs(vtc.quitDate).format('YYYY年MM月DD日')})`).join('\n')}`
        }
        message += '\n🚚车队角色: ' + playerInfo.data.vtcRole;
        if (playerInfo.data.vtcId == 74950) {
            const { url, token, logOutput } = cfg.mainSettings;
            try {
                if (logOutput) {
                    ctx.logger.info(`tmpQuery：开始查询TmpID ${tmpId} 的积分`);
                }
                const userInfoUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=7&tmpId=${tmpId}&tmpName=&teamId=&qq=&state=0&teamRole=`;
                if (logOutput) {
                    ctx.logger.info(`请求用户信息: ${userInfoUrl}`);
                }
                const userInfoResponse = await ctx.http.post(userInfoUrl);
                if (logOutput) {
                    ctx.logger.info(`用户信息响应: ${JSON.stringify(userInfoResponse)}`);
                }
                const userList = userInfoResponse.page?.list || [];
                const userInfo = userList[0];
                const rewardPoints = userInfo.rewardPoints || 0;
                message += `\n⭐ 当前车队积分: ${rewardPoints}`;
            } catch (error) {
                ctx.logger.error(`积分查询过程出错: ${error}`);
                if (error.response) {
                    message += '查询出错';
                }
            }
        }
    }
    message += '\n\n🚫是否封禁: ' + (playerInfo.data.isBan ? '是' : '否');
    if (playerInfo.data.isBan) {
        message += '\n🚫封禁截止: ';
        if (playerInfo.data.banHide) {
            message += '隐藏';
        }
        else {
            if (!playerInfo.data.banUntil) {
                message += '永久';
            }
            else {
                message += dayjs(playerInfo.data.banUntil).format('YYYY年MM月DD日 HH:mm');
            }
            message += "\n🚫封禁原因: " + (playerInfo.data.banReasonZh || playerInfo.data.banReason);
        }
    }
    message += '\n🚫封禁次数: ' + (playerInfo.data.banCount || 0);
    if (playerInfo.data.mileage) {
        let mileage = playerInfo.data.mileage;
        let mileageUnit = '米';
        if (mileage > 1000) {
            mileage = (mileage / 1000).toFixed(1);
            mileageUnit = '公里';
        }
        message += '\n\n🚩历史里程: ' + mileage + mileageUnit;
    }
    if (playerInfo.data.todayMileage) {
        let todayMileage = playerInfo.data.todayMileage;
        let mileageUnit = '米';
        if (todayMileage > 1000) {
            todayMileage = (todayMileage / 1000).toFixed(1);
            mileageUnit = '公里';
        }
        message += '\n🚩今日里程: ' + todayMileage + mileageUnit;
    }
    if (playerMapInfo && !playerMapInfo.error) {
        message += '\n📶在线状态: ' + (playerMapInfo.data.online ? `在线🟢 (${playerMapInfo.data.serverDetails.name})` : '离线⚫');
        if (playerMapInfo.data.online) {
            message += '\n🌍线上位置: ';
            message += await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.country);
            message += ' - ';
            message += await baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.realName);
        }
        else if (playerInfo.data.lastOnlineTime) {
            message += '\n📶上次在线: ' + dayjs(playerInfo.data.lastOnlineTime).fromNow(false);
        }
    }
    message += '\n\n🌟是否Patreon支持者: '
    if (playerInfo.data.isSponsor) {
        message += '是'
    }
    else {
        message += '否'
    }
    message += '\n💰当前赞助金额: '
    if (playerInfo.data.sponsorAmount == 'null') {
        message += '0美金'
    }
    else {
        message += playerInfo.data.sponsorAmount / 100 + '美金'
    }
    message += '\n💰全部赞助金额: '
    if (playerInfo.data.sponsorCumulativeAmount == 'null') {
        message += '0美金'
    }
    else {
        message += playerInfo.data.sponsorCumulativeAmount / 100 + '美金'
    }
    return message;
};
