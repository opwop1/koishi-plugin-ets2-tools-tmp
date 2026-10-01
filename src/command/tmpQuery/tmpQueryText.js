const dayjs = require('dayjs');
const dayjsRelativeTime = require('dayjs/plugin/relativeTime');
const dayjsLocaleZhCn = require('dayjs/locale/zh-cn');
const guildBind = require('../../database/guildBind');
const tmpIdPicker = require('../../util/tmpIdPicker');
const truckyAppApi = require('../../api/truckyAppApi');
const evmOpenApi = require('../../api/evmOpenApi');
const baiduTranslate = require('../../util/baiduTranslate');
dayjs.extend(dayjsRelativeTime);
dayjs.locale(dayjsLocaleZhCn);

/**
 * 里程文本：>=1000 米换算成公里；0 显示成「0公里」（表示这款游戏没跑过）
 */
function formatMileageText(value) {
    const n = Number(value) || 0;
    if (n <= 0) {
        return '0公里';
    }
    if (n >= 1000) {
        return Number((n / 1000).toFixed(1)).toLocaleString('en-US') + '公里';
    }
    return n + '米';
}

/**
 * 欧卡/美卡里程明细文本（两者都为 0 时返回空串）
 */
function formatMileageDetail(ets2, ats) {
    const ets2Val = Number(ets2) || 0;
    const atsVal = Number(ats) || 0;
    if (ets2Val <= 0 && atsVal <= 0) {
        return '';
    }
    return ` (欧卡 ${formatMileageText(ets2Val)} / 美卡 ${formatMileageText(atsVal)})`;
}
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
    // 如果没有传入tmpId，尝试从绑定记录获取（多绑定时会列出序号供选择，支持多选）
    if (!tmpId) {
        const bindings = await guildBind.list(ctx.database, session.platform, session.userId);
        if (bindings.length === 0) {
            return `请输入正确的玩家编号`;
        }
        const picked = await tmpIdPicker.pick(ctx, session, bindings);
        if (picked === null) {
            return; // 已列出序号等待用户回复
        }
        if (picked.length > 1) {
            const results = [];
            for (const id of picked) {
                const r = await module.exports(ctx, cfg, session, id);
                if (r != null) results.push(r);
            }
            return results.length === 1 ? results[0] : results;
        }
        tmpId = picked[0];
    }
    // 并行请求玩家信息与线上状态（互不依赖，避免串行等待）
    const [playerInfo, playerMapInfo] = await Promise.all([
        evmOpenApi.playerInfo(ctx.http, tmpId),
        truckyAppApi.online(ctx.http, tmpId)
    ]);
    if (playerInfo.error && playerInfo.code === 10001) {
        return '玩家不存在';
    }
    else if (playerInfo.error) {
        return '玩家信息查询失败，请重试';
    }
    // Steam游戏时长请求提前发起，与下方积分查询并行执行
    const steamApiKey = cfg.steamApi?.key;
    const steamGameTimePromise = (cfg.commands?.tmpQueryGameTime && steamApiKey)
        ? evmOpenApi.steamGameTime(ctx.http, steamApiKey, playerInfo.data.steamId)
        : null;
    // 拼接消息模板
    let message = '';
    if (cfg.tmpQuery?.showAvatar) {
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
        if (cfg.commands?.tmpQueryHistory) {
            if (playerInfo.data.vtcHistory && playerInfo.data.vtcHistory.length > 0) {
                message += `\n📜历史车队:\n${playerInfo.data.vtcHistory.map(vtc => `- ${vtc.vtcName}\n(加入时间: ${dayjs(vtc.joinDate).format('YYYY年MM月DD日')}, 离开日期: ${dayjs(vtc.quitDate).format('YYYY年MM月DD日')})`).join('\n')}`
            }
        }
        message += '\n🚚车队角色: ' + playerInfo.data.vtcRole;
        if (cfg.commands?.mainSettings) {
            // 仅在主群或管理群中显示车队积分
            const mainGroups = cfg.tmpActivityService?.mainGroup?.groups || [];
            const adminGroups = cfg.tmpActivityService?.admin?.groups || [];
            const allowedGroups = [...new Set([...mainGroups, ...adminGroups])];
            const currentGroupId = session.channelId || '';
            const isInAllowedGroup = allowedGroups.some(g => currentGroupId.includes(g));

            if (isInAllowedGroup && playerInfo.data.vtcId == vtcId) {
                const { url, token, logOutput } = cfg.mainSettings?.settings || {};
                try {
                    let rewardPoints = 0;
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] tmpQuery：开始查询TmpID ${tmpId} 的积分`);
                    }
                    const userInfoUrl = `https://${url}/api/user/info/list?token=${token}&page=0&limit=7&tmpId=${tmpId}&tmpName=&teamId=&qq=&state=0&teamRole=`;
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] 请求用户信息: ${userInfoUrl}`);
                    }
                    const userInfoResponse = await ctx.http.post(userInfoUrl);
                    if (logOutput) {
                        ctx.logger.info(`[TMP_BOT] 用户信息响应: ${JSON.stringify(userInfoResponse)}`);
                    }
                    const userList = userInfoResponse.page?.list || [];
                    const userInfo = userList[0];
                    rewardPoints = userInfo.rewardPoints || 0;
                    message += `\n⭐ 当前车队积分: ${rewardPoints}`;
                } catch (error) {
                    ctx.logger.error(`积分查询过程出错: ${error}`);
                    if (error.response) {
                        message += '查询出错';
                    }
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
    // 历史/今日里程为欧卡+美卡合计，后面附上两款游戏的单独里程
    if (playerInfo.data.mileage) {
        message += '\n\n🚩历史里程: ' + formatMileageText(playerInfo.data.mileage)
            + formatMileageDetail(playerInfo.data.mileageEts2, playerInfo.data.mileageAts);
    }
    if (playerInfo.data.todayMileage) {
        message += '\n🚩今日里程: ' + formatMileageText(playerInfo.data.todayMileage)
            + formatMileageDetail(playerInfo.data.todayMileageEts2, playerInfo.data.todayMileageAts);
    }
    if (playerMapInfo && !playerMapInfo.error) {
        message += '\n📶在线状态: ' + (playerMapInfo.data.online ? `在线🟢 (${playerMapInfo.data.serverDetails.name})` : '离线⚫');
        if (playerMapInfo.data.online) {
            const [onlineCountry, onlineCity] = await Promise.all([
                baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.country),
                baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.realName)
            ]);
            message += '\n🌍线上位置: ' + onlineCountry + ' - ' + onlineCity;
        }
        else if (playerInfo.data.lastOnlineTime) {
            message += '\n📶上次在线: ' + dayjs(playerInfo.data.lastOnlineTime).fromNow(false);
        }
    }
    // 获取欧卡和美卡游戏时长（请求已提前发起，与积分查询/翻译并行）
    if (cfg.commands?.tmpQueryGameTime) {
        const gameTimes = (await steamGameTimePromise) || { ets2: null, ats: null };

        // 添加游戏时长信息
        if (gameTimes.ets2) {
            message += '\n🎮欧卡游戏时长: ' + gameTimes.ets2;
        }
        if (gameTimes.ats) {
            message += '\n🎮美卡游戏时长: ' + gameTimes.ats;
        }
    }
    
    if (cfg.commands?.tmpQuerySponsor) {
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
    }
    return message;
};
