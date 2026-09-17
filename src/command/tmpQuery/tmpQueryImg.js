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
 * 渲染倍率。1 = 原始像素（偏糊），2 = 视网膜屏清晰度。
 * 代价：像素面积 ×4、单张渲染内存与耗时上升；配合 JPEG 编码后体积反而比 1 倍 PNG 更小。
 */
const RENDER_SCALE = 2;
/**
 * 遥测数据超过这个时长即视为过期，整块不显示（默认 2 分钟）
 */
const TELEMETRY_MAX_AGE_MS = 2 * 60 * 1000;
/**
 * 遥测记录距今的时间差（毫秒）。
 * updateTime 是 UTC 字面量、updateTimeCn 是北京时间字面量，两者都能换算成绝对时间，
 * 因此与机器人所在时区无关；两个字段都取不到时返回 null。
 */
function telemetryRecordAge(player) {
    const asUtc = (s) => {
        const t = Date.parse(String(s).replace(' ', 'T') + 'Z');
        return Number.isNaN(t) ? null : t;
    };
    const asCn = (s) => {
        const t = Date.parse(String(s).replace(' ', 'T') + '+08:00');
        return Number.isNaN(t) ? null : t;
    };
    let ts = player.updateTime ? asUtc(player.updateTime) : null;
    if (ts === null && player.updateTimeCn) ts = asCn(player.updateTimeCn);
    if (ts === null) return null;
    return Date.now() - ts;
}
/**
 * 查询玩家信息
 */
module.exports = async (ctx, cfg, session, tmpId) => {
    const { vtcId } = cfg.tmpActivityService?.api || {};
    // 车队平台配置（遥测 / 积分共用），提前取出供多处使用
    const mainSettingValues = cfg.mainSettings?.settings || {};
    const platformUrl = mainSettingValues.url;
    const platformToken = mainSettingValues.token;
    const logOutput = mainSettingValues.logOutput;
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
    // 并行请求玩家信息与线上状态（互不依赖，避免串行等待）
    const [playerInfo, playerMapInfo] = await Promise.all([
        evmOpenApi.playerInfo(ctx.http, tmpId),
        truckyAppApi.online(ctx.http, tmpId)
    ]);
    if (playerInfo.error && playerInfo.code === 10001) {
        return '玩家不存在';
    }
    else if (playerInfo.error) {
        return '查询玩家信息失败，请重试';
    }
    // ===== 车队平台实时遥测（在线 + 本队成员） =====
    // 触发条件：玩家当前在线，且其 vtcId 与 tmpActivityService.api.vtcId 一致
    const isOwnVtcMember = vtcId !== undefined && vtcId !== null && vtcId !== '' &&
        playerInfo.data.vtcId !== undefined && playerInfo.data.vtcId !== null &&
        String(playerInfo.data.vtcId) === String(vtcId);
    // 玩家离线时没有实时遥测可看，直接不发请求
    const isPlayerOnline = !!(playerMapInfo && !playerMapInfo.error && playerMapInfo.data && playerMapInfo.data.online);
    // 请求提前发起，与下方的积分查询 / 翻译 / Steam时长并行，避免串行等待
    const telemetryPromise = (platformUrl && platformToken && isPlayerOnline && isOwnVtcMember)
        ? (async () => {
            const telemetryUrl = `https://${platformUrl}/api/telemetry/bot/live?tmpId=${tmpId}&token=${platformToken}`;
            try {
                if (logOutput) {
                    ctx.logger.info(`[TMP_BOT] tmpQueryImg：开始查询TmpID ${tmpId} 的V1.0实时遥测`);
                    ctx.logger.info(`[TMP_BOT] 请求V1.0遥测接口: ${telemetryUrl.replace(platformToken, "***")}`);
                }
                const telemetryResponse = await ctx.http.get(telemetryUrl, { timeout: 10000 });
                const playerList = telemetryResponse?.data?.players;
                if (logOutput) {
                    ctx.logger.info(`[TMP_BOT] V1.0遥测响应: code=${telemetryResponse?.code}, online=${telemetryResponse?.data?.online}, players=${Array.isArray(playerList) ? playerList.length : 0}`);
                }
                if (telemetryResponse && telemetryResponse.code === 0 && Array.isArray(playerList) && playerList.length > 0) {
                    // 优先取与查询 tmpId 一致的那条，避免接口返回多人的情况
                    const matched = playerList.find(p => p && String(p.tmpId) === String(tmpId)) || playerList[0];
                    // players 为空数组（无遥测记录）时不返回，渲染页会整块隐藏
                    if (!matched || typeof matched !== 'object') {
                        return null;
                    }
                    // 记录时间距今超过 TELEMETRY_MAX_AGE_MS 视为过期，同样不显示
                    const ageMs = telemetryRecordAge(matched);
                    if (ageMs === null || ageMs > TELEMETRY_MAX_AGE_MS) {
                        if (logOutput) {
                            ctx.logger.info(`[TMP_BOT] V1.0遥测记录已过期（${ageMs === null ? '无有效时间戳' : Math.round(ageMs / 1000) + ' 秒前'}），不显示遥测板块`);
                        }
                        return null;
                    }
                    return {
                        online: telemetryResponse.data.online === 1,
                        generatedAt: telemetryResponse.data.generatedAt || null,
                        player: matched
                    };
                }
                if (logOutput) {
                    ctx.logger.info(`[TMP_BOT] V1.0遥测接口未返回记录（players 为空），不显示遥测板块`);
                }
                return null;
            } catch (error) {
                ctx.logger.error(`遥测查询过程出错: ${error}`);
                return null;
            }
        })()
        : null;
    // Steam游戏时长请求提前发起，与下方积分查询/翻译并行执行
    const steamApiKey = cfg.steamApi?.key;
    const steamGameTimePromise = (cfg.commands?.tmpQueryGameTime && steamApiKey)
        ? evmOpenApi.steamGameTime(ctx.http, steamApiKey, playerInfo.data.steamId)
        : null;
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
            const [onlineCountry, onlineCity] = await Promise.all([
                baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.country),
                baiduTranslate(ctx, cfg, playerMapInfo.data.location.poi.realName)
            ]);
            data.onlineCountry = onlineCountry;
            data.onlineCity = onlineCity;
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
            try {
                if (logOutput) {
                    ctx.logger.info(`[TMP_BOT] tmpQueryImg：开始查询TmpID ${tmpId} 的积分`);
                }
                const userInfoUrl = `https://${platformUrl}/api/user/info/list?token=${platformToken}&page=0&limit=7&tmpId=${tmpId}&tmpName=&teamId=&qq=&state=0&teamRole=`;
                if (logOutput) {
                    ctx.logger.info(`[TMP_BOT] 请求用户信息: ${userInfoUrl}`);
                }
                const userInfoResponse = await ctx.http.post(userInfoUrl);
                if (logOutput) {
                    ctx.logger.info(`[TMP_BOT] 用户信息响应: ${JSON.stringify(userInfoResponse)}`);
                }
                const userList = userInfoResponse.page?.list || [];
                const userInfo = userList[0];
                data.rewardPoints = userInfo.rewardPoints || 0;
            } catch (error) {
                ctx.logger.error(`积分查询过程出错: ${error}`);
            }
        }
    }
    // 等待V1遥测结果（请求已提前发起，与积分查询/Steam时长并行）
    data.telemetry = telemetryPromise ? await telemetryPromise : null;
    // 等待Steam游戏时长结果（请求已提前发起，与积分查询/翻译并行）
    data.ets2GameTime = null;
    data.atsGameTime = null;
    if (steamGameTimePromise) {
        const gameTimes = await steamGameTimePromise;
        data.ets2GameTime = gameTimes.ets2;
        data.atsGameTime = gameTimes.ats;
    }
    let page;
    try {
        page = await ctx.puppeteer.page();
        // deviceScaleFactor=RENDER_SCALE：按 RENDER_SCALE 倍像素渲染，客户端放大后依然清晰
        await page.setViewport({ width: 520, height: 1000, deviceScaleFactor: RENDER_SCALE });
        await page.goto(`file:///${resolve(__dirname, '../../resource/query.html')}`);
        await page.evaluate(`init(${JSON.stringify(data)})`);
        await common.sleep(100);
        await page.waitForNetworkIdle();
        const element = await page.$("#container");
        // 用 JPEG 编码：同一清晰度下体积远小于 PNG（卡片背景不透明，无需 alpha 通道）
        return (segment.image(await element.screenshot({
            type: "jpeg",
            quality: 90,
            encoding: "binary"
        }), "image/jpeg"));
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
