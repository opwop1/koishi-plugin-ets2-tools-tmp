"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const model = require('./database/model');
const { MileageRankingType } = require('./util/constant');
const tmpQuery = require('./command/tmpQuery/tmpQuery');
const tmpServer = require('./command/tmpServer');
const tmpBind = require('./command/tmpBind');
const tmpTraffic = require('./command/tmpTraffic/tmpTraffic');
const tmpPosition = require('./command/tmpPosition');
const tmpVersion = require('./command/tmpVersion');
const tmpDlcMap = require('./command/tmpDlcMap');
const tmpMileageRanking = require('./command/tmpMileageRanking');
const resetPassword = require('./command/ets-app/resetPassword');
const queryPoint = require('./command/ets-app/queryPoint');
const tmpVtc = require('./command/tmpVtc');
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
    for (var name2 in all)
        __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var src_exports = {};
__export(src_exports, {
    Config: () => Config,
    apply: () => apply,
    name: () => name
});

exports.name = 'tmp-bot';
exports.inject = {
    required: ['database'],
    optional: ['puppeteer']
};
exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        baiduTranslateEnable: koishi_1.Schema.boolean().default(false).description('启用百度翻译'),
        baiduTranslateAppId: koishi_1.Schema.string().description('百度翻译APP ID'),
        baiduTranslateKey: koishi_1.Schema.string().description('百度翻译秘钥'),
        baiduTranslateCacheEnable: koishi_1.Schema.boolean().default(false).description('启用百度翻译缓存')
    }).description('指令基本配置'),
    koishi_1.Schema.object({
        queryShowAvatarEnable: koishi_1.Schema.boolean().default(false).description('查询指令展示头像，部分玩家的擦边头像可能导致封号'),
        tmpTrafficType: koishi_1.Schema.union([
            koishi_1.Schema.const(1).description('文字'),
            koishi_1.Schema.const(2).description('热力图')
        ]).default(1).description('路况信息展示方式'),
        tmpQueryType: koishi_1.Schema.union([
            koishi_1.Schema.const(1).description('文字'),
            koishi_1.Schema.const(2).description('图片')
        ]).default(1).description('玩家信息展示方式'),
    }).description('指令名称配置'),
    koishi_1.Schema.object({
        mainSettings: koishi_1.Schema.object({
            url: koishi_1.Schema.string().description("API服务器地址").required(),
            token: koishi_1.Schema.string().description("API认证令牌").required(),
            logOutput: koishi_1.Schema.boolean().description("是否输出日志").default(true)
        }).description("车队平台设置")
    }),
    koishi_1.Schema.object({
        resetPassword: koishi_1.Schema.object({
            adminUsers: koishi_1.Schema.array(koishi_1.Schema.string()).description("管理员用户ID（拥有重置任意teamId权限）").default([])
        }).description("重置密码指令设置")
    }),
    koishi_1.Schema.object({
        activityQuertEnable: koishi_1.Schema.boolean().default(false).description('是否启用活动查询'),
    }).description("活动查询 - 开关"),
    koishi_1.Schema.object({
        adminUseHttps: koishi_1.Schema.boolean().description("使用HTTPS协议").default(true),
        adminApiUrl: koishi_1.Schema.string().required().description("车队平台URL（不包含协议）").default(""),
        adminApiToken: koishi_1.Schema.string().required().description("车队平台TOKEN").default(""),
        adminVtcId: koishi_1.Schema.string().required().description("VTC ID（用于TMP API）").default("")
    }).description("活动查询 - API配置"),
    koishi_1.Schema.object({
        adminCheckTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("活动检查时间（HH:mm格式）").default(["08:00", "12:00", "14:00", "20:00"]),
        adminSendTimes: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("信息发送时间（HH:mm格式）").default(["08:05", "12:05", "14:05", "20:05"]),
        adminGroups: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("管理群组ID列表").default([])
    }).description("活动查询 - 管理群配置"),
    koishi_1.Schema.object({
        adminServerSource: koishi_1.Schema.union([
            koishi_1.Schema.const("platform").description("车队平台API"),
            koishi_1.Schema.const("tmp").description("TMP API")
        ]).description("服务器信息来源").default("tmp"),
        adminStartPointSource: koishi_1.Schema.union([
            koishi_1.Schema.const("platform").description("车队平台API"),
            koishi_1.Schema.const("tmp").description("TMP API")
        ]).description("起点信息来源").default("tmp"),
        adminEndPointSource: koishi_1.Schema.union([
            koishi_1.Schema.const("platform").description("车队平台API"),
            koishi_1.Schema.const("tmp").description("TMP API")
        ]).description("终点信息来源").default("tmp"),
        adminShowBanner: koishi_1.Schema.boolean().description("是否显示活动横幅").default(false)
    }).description("活动查询 - 数据源配置"),
    koishi_1.Schema.object({
        adminProfileUploadedMessage: koishi_1.Schema.string().description("活动档已上传时的消息").default("今日活动档已做/上传"),
        adminProfileNotUploadedMessage: koishi_1.Schema.string().description("活动档未上传时的消息").default("今日活动档还没做，请负责的管理注意！")
    }).description("活动查询 - 管理群消息配置"),
    koishi_1.Schema.object({
        mainGroups: koishi_1.Schema.array(koishi_1.Schema.string()).role("table").description("主群群号列表").default([]),
        mainActivityReminderMessage: koishi_1.Schema.string().description("活动提醒消息模板，支持变量：{name}, {server}, {startingPoint}, {terminalPoint}, {distance}, {banner}, {timeLeft}").default("活动 {name} 还有 {timeLeft} 分钟就要开始啦!\n服务器: {server}\n起点: {startingPoint}\n终点: {terminalPoint}\n距离: {distance}KM"),
        mainActivityReminderTimes: koishi_1.Schema.array(koishi_1.Schema.number()).role("table").description("活动开始前提醒时间（分钟）").default([60, 30, 15])
    }).description("活动查询 - 主群配置"),
    koishi_1.Schema.object({
        debugMode: koishi_1.Schema.boolean().description("启用调试模式（输出详细日志）").default(false),
        logApiResponses: koishi_1.Schema.boolean().description("记录API响应详情").default(false),
        logTimingDetails: koishi_1.Schema.boolean().description("记录定时任务执行详情").default(false),
        logActivityMatching: koishi_1.Schema.boolean().description("记录活动匹配过程").default(false),
        logMessageSending: koishi_1.Schema.boolean().description("记录消息发送详情").default(false)
    }).description("活动查询 - 开发者选项")
]);

function apply(ctx, cfg) {
    try {
        model(ctx);
        if (cfg.debugMode) {
            ctx.logger.debug("[TMP-BOT] 数据库模型初始化成功");
        }
    } catch (error) {
        ctx.logger.error("[TMP-BOT] 数据库模型初始化失败:", error.message);
        return;
    }

    // 注册指令
    ctx.command('查询 <tmpId>').action(async ({ session }, tmpId) => await tmpQuery(ctx, cfg, session, tmpId));
    ctx.command('美卡服务器').action(async () => await tmpServer(ctx, cfg, 'ATS'));
    ctx.command('欧卡服务器').action(async () => await tmpServer(ctx, cfg, 'ETS2'));
    ctx.command('绑定 <tmpId>').action(async ({ session }, tmpId) => await tmpBind(ctx, cfg, session, tmpId));
    ctx.command('路况 <serverName>').action(async ({ session }, serverName) => await tmpTraffic(ctx, cfg, serverName));
    ctx.command('定位 <tmpId>').action(async ({ session }, tmpId) => await tmpPosition(ctx, cfg, session, tmpId));
    ctx.command('tmp版本').action(async () => await tmpVersion(ctx));
    ctx.command('地图dlc价格').action(async ({ session }) => await tmpDlcMap(ctx, session));
    ctx.command('里程排行榜').action(async ({ session }) => await tmpMileageRanking(ctx, session, MileageRankingType.total));
    ctx.command('今日里程排行榜').action(async ({ session }) => await tmpMileageRanking(ctx, session, MileageRankingType.today));
    ctx.command('vtc查询 <vtcid>').action(async ({ session }, vtcid) => await tmpVtc(ctx, cfg, session, vtcid));
    ctx.command(`重置密码 [targetTeamId:string]`, "重置欧卡车队平台密码")
        .usage("重置自己的密码，或管理员重置指定teamId的密码")
        .example(`重置密码new - 重置自己的密码`)
        .example(`重置密码new 123 - 管理员重置指定teamId的密码`)
        .action(async ({ session }, targetTeamId) => await resetPassword(ctx, cfg, session, targetTeamId));
    ctx.command(`查询积分 [targetQQ:string]`, "查询欧卡车队平台积分")
        .usage("查询自己或指定QQ号的积分，在群聊中可@他人查询")
        .example(`查询积分 - 查询自己的积分`)
        .example(`查询积分 123456 - 查询指定QQ号的积分`)
        .action(async ({ session }, targetQQ) => await queryPoint(ctx, cfg, session, targetQQ));
    ctx.command('规则查询').action(async ({ session }) => {
        return 'TruckersMP官方规则链接：https://truckersmp.com/knowledge-base/article/746';
    });
    if (cfg.activityQuertEnable) {
        let todayActivities = [];
        let todayTMPEvents = [];
        const sentReminders = /* @__PURE__ */ new Set();
        const timers = [];
        const logger = {
            debug: /* @__PURE__ */ __name((message, ...args) => {
                if (cfg.debugMode) {
                    ctx.logger.debug(`[TMP-BOT DEBUG] ${message}`, ...args);
                }
            }, "debug"),
            info: /* @__PURE__ */ __name((message, ...args) => {
                ctx.logger.info(`[TMP-BOT] ${message}`, ...args);
            }, "info"),
            warn: /* @__PURE__ */ __name((message, ...args) => {
                ctx.logger.warn(`[TMP-BOT WARN] ${message}`, ...args);
            }, "warn"),
            error: /* @__PURE__ */ __name((message, ...args) => {
                ctx.logger.error(`[TMP-BOT ERROR] ${message}`, ...args);
            }, "error"),
            api: /* @__PURE__ */ __name((message, data) => {
                if (cfg.logApiResponses) {
                    ctx.logger.info(`[TMP-BOT API] ${message}`, data ? JSON.stringify(data, null, 2) : "");
                }
            }, "api"),
            timing: /* @__PURE__ */ __name((message, data) => {
                if (cfg.logTimingDetails) {
                    ctx.logger.info(`[TMP-BOT TIMING] ${message}`, data || "");
                }
            }, "timing"),
            matching: /* @__PURE__ */ __name((message, data) => {
                if (cfg.logActivityMatching) {
                    ctx.logger.info(`[TMP-BOT MATCHING] ${message}`, data || "");
                }
            }, "matching"),
            message: /* @__PURE__ */ __name((message, data) => {
                if (cfg.logMessageSending) {
                    ctx.logger.info(`[TMP-BOT MESSAGE] ${message}`, data || "");
                }
            }, "message")
        };
        setupDailyTasks();

        // 获取下次执行时间（修复函数命名）
        function getNextTime(hours, minutes) {
            const now = /* @__PURE__ */ new Date();
            const target = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hours,
                minutes,
                0,
                0
            );
            if (target.getTime() <= now.getTime()) {
                target.setDate(target.getDate() + 1);
            }
            return target.getTime() - now.getTime();
        }
        __name(getNextTime, "getNextTime");

        // 重置每日数据
        function resetDailyData() {
            const previousActivityCount = todayActivities.length;
            const previousTMPCount = todayTMPEvents.length;
            const previousReminderCount = sentReminders.size;
            todayActivities = [];
            todayTMPEvents = [];
            sentReminders.clear();
            logger.debug(`每日数据已重置: 活动${previousActivityCount}→0, TMP${previousTMPCount}→0, 提醒${previousReminderCount}→0`);
            updateActivityData();
        }
        __name(resetDailyData, "resetDailyData");

        // 设置每日定时任务
        function setupDailyTasks() {
            logger.timing("开始设置每日定时任务");

            // 每日2:00重置数据
            const resetHour = 2;
            const resetMinute = 0;
            const resetDelay = getNextTime(resetHour, resetMinute);
            const resetTimer = setTimeout(() => {
                logger.timing("执行每日数据重置");
                resetDailyData();
                const dailyResetTimer = setInterval(() => {
                    logger.timing("执行每日数据重置");
                    resetDailyData();
                }, koishi_1.Time.day);
                timers.push(dailyResetTimer);
            }, resetDelay);
            timers.push(resetTimer);
            logger.timing(`设置数据重置定时器: ${resetHour}:${resetMinute.toString().padStart(2, "0")}, 延迟: ${resetDelay}ms`);

            // 活动检查定时任务
            cfg.adminCheckTimes.forEach((timeStr, index) => {
                const [hours, minutes] = timeStr.split(":").map(Number);
                const setupTimer = /* @__PURE__ */ __name(() => {
                    const delay = getNextTime(hours, minutes);
                    const timer = setTimeout(() => {
                        logger.timing(`执行定时检查任务 #${index + 1} (${timeStr})`);
                        updateActivityData();
                        const dailyTimer = setInterval(() => {
                            logger.timing(`执行每日检查任务 #${index + 1} (${timeStr})`);
                            updateActivityData();
                        }, koishi_1.Time.day);
                        timers.push(dailyTimer);
                    }, delay);
                    timers.push(timer);
                    logger.timing(`设置检查定时器 #${index + 1}: ${timeStr}, 延迟: ${delay}ms`);
                }, "setupTimer");
                setupTimer();
            });

            // 管理群消息发送定时任务
            cfg.adminSendTimes.forEach((timeStr, index) => {
                const [hours, minutes] = timeStr.split(":").map(Number);
                const setupTimer = /* @__PURE__ */ __name(() => {
                    const delay = getNextTime(hours, minutes);
                    const timer = setTimeout(() => {
                        logger.timing(`执行定时发送任务 #${index + 1} (${timeStr})`);
                        checkAndSendProfileReminders();
                        const dailyTimer = setInterval(() => {
                            logger.timing(`执行每日发送任务 #${index + 1} (${timeStr})`);
                            checkAndSendProfileReminders();
                        }, koishi_1.Time.day);
                        timers.push(dailyTimer);
                    }, delay);
                    timers.push(timer);
                    logger.timing(`设置发送定时器 #${index + 1}: ${timeStr}, 延迟: ${delay}ms`);
                }, "setupTimer");
                setupTimer();
            });

            // 每分钟检查活动提醒
            const minuteTimer = setInterval(async () => {
                await checkAndSendActivityReminders();
            }, koishi_1.Time.minute);
            timers.push(minuteTimer);
            logger.timing("设置每分钟检查定时器");

            // 启动时立即更新活动数据
            logger.debug("启动时立即更新活动数据");
            updateActivityData();
        }
        __name(setupDailyTasks, "setupDailyTasks");

        // 更新活动数据（主函数）
        async function updateActivityData() {
            try {
                logger.debug("开始更新活动数据");
                const startTime = Date.now();
                await updateTodayActivities();
                await updateTodayTMPEvents();
                const duration = Date.now() - startTime;
                logger.info(`活动数据更新完成，耗时: ${duration}ms`);
                logger.debug(`今日活动数量: ${todayActivities.length}, TMP活动数量: ${todayTMPEvents.length}`);
            } catch (error) {
                logger.error("更新活动数据失败:", error.message);
            }
        }
        __name(updateActivityData, "updateActivityData");

        // 从车队平台获取今日活动
        async function updateTodayActivities() {
            try {
                const protocol = cfg.adminUseHttps ? "https://" : "http://";
                const fullUrl = `${protocol}${cfg.adminApiUrl}/api/activity/info/list?token=${cfg.adminApiToken}&page=1&limit=50&themeName=`;
                logger.api(`请求车队平台API: ${fullUrl.replace(cfg.adminApiToken, "***")}`);

                const startTime = Date.now();
                // 添加10秒超时配置
                const response = await ctx.http.get(fullUrl, { timeout: 10000 });
                const duration = Date.now() - startTime;
                logger.api(`车队平台API响应耗时: ${duration}ms, 状态码: ${response.code}`);

                if (cfg.logApiResponses) {
                    logger.api("车队平台API响应详情:", {
                        code: response.code,
                        totalCount: response.data?.totalCount,
                        listCount: response.data?.list?.length
                    });
                }

                if (response.code === 0 && response.data?.list) {
                    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
                    const originalCount = response.data.list.length;
                    todayActivities = response.data.list.filter((activity) => {
                        const activityDate = activity.startTime?.split(" ")[0];
                        return activityDate === today;
                    });
                    logger.info(`从车队平台找到 ${todayActivities.length}/${originalCount} 个今日活动`);
                    logger.debug("今日活动列表:", todayActivities.map((a) => ({
                        id: a.id,
                        name: a.themeName,
                        time: a.startTime,
                        hasProfile: !!a.profileFile
                    })));
                } else {
                    logger.error(`车队平台API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                    todayActivities = []; // 接口错误时清空数据，避免使用旧数据
                }
            } catch (error) {
                logger.error("获取车队平台活动列表失败:", error.message);
                todayActivities = [];
            }
        }
        __name(updateTodayActivities, "updateTodayActivities");

        // 从TMP API获取今日活动
        async function updateTodayTMPEvents() {
            try {
                if (!cfg.adminVtcId) {
                    logger.warn("TMP API请求失败：未配置adminVtcId");
                    todayTMPEvents = [];
                    return;
                }
                const tmpApiUrl = `https://api.truckersmp.com/v2/vtc/${cfg.adminVtcId}/events/attending/`;
                logger.api(`请求TMP API: ${tmpApiUrl}`);

                const startTime = Date.now();
                // 添加10秒超时配置
                const response = await ctx.http.get(tmpApiUrl, { timeout: 10000 });
                const duration = Date.now() - startTime;
                logger.api(`TMP API响应耗时: ${duration}ms, 错误状态: ${response.error}`);

                if (!response.error && Array.isArray(response.response)) {
                    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
                    const originalCount = response.response.length;
                    todayTMPEvents = response.response.filter((event) => {
                        const eventDate = event.start_at?.split(" ")[0];
                        return eventDate === today;
                    });
                    logger.info(`从TMP找到 ${todayTMPEvents.length}/${originalCount} 个今日活动`);
                    if (cfg.logApiResponses) {
                        logger.debug("TMP活动列表:", todayTMPEvents.map((e) => ({
                            id: e.id,
                            name: e.name,
                            time: e.start_at,
                            server: e.server?.name
                        })));
                    }
                } else {
                    logger.error(`TMP API返回错误: ${response.message || '未知错误'}`);
                    todayTMPEvents = [];
                }
            } catch (error) {
                logger.error("获取TMP活动失败:", error.message);
                todayTMPEvents = [];
            }
        }
        __name(updateTodayTMPEvents, "updateTodayTMPEvents");

        // 检查并发送活动档提醒（管理群）
        async function checkAndSendProfileReminders() {
            if (todayActivities.length === 0) {
                logger.debug("今日没有活动，跳过档位检查");
                return;
            }
            logger.debug(`开始检查 ${todayActivities.length} 个活动的档位状态`);

            for (const activity of todayActivities) {
                const hasProfile = !!activity.profileFile;
                const message = hasProfile ? cfg.adminProfileUploadedMessage : cfg.adminProfileNotUploadedMessage;
                const fullMessage = `活动 "${activity.themeName || '未知活动'}" - ${message}`;
                logger.message(`活动档位检查: "${activity.themeName || '未知活动'}" - ${hasProfile ? "已上传" : "未上传"}`);

                for (const groupId of cfg.adminGroups) {
                    try {
                        await sendToGroup(groupId, fullMessage, "管理群组");
                        logger.message(`已发送档位提醒到管理群组 ${groupId}: ${activity.themeName || '未知活动'}`);
                    } catch (error) {
                        logger.error(`发送消息到管理群组 ${groupId} 失败:`, error.message);
                    }
                }
            }
        }
        __name(checkAndSendProfileReminders, "checkAndSendProfileReminders");

        // 检查并发送活动提醒（主群）
        async function checkAndSendActivityReminders() {
            const now = /* @__PURE__ */ new Date();
            let remindersSent = 0;
            logger.debug(`检查 ${todayActivities.length} 个活动的提醒时间`);

            for (const activity of todayActivities) {
                try {
                    const activityStartTime = new Date(activity.startTime);
                    if (isNaN(activityStartTime.getTime())) {
                        logger.warn(`活动 "${activity.themeName}" 开始时间格式错误，跳过提醒`);
                        continue;
                    }

                    const timeDiff = activityStartTime.getTime() - now.getTime();
                    const minutesLeft = Math.floor(timeDiff / (1e3 * 60));
                    logger.debug(`活动 "${activity.themeName}" 剩余时间: ${minutesLeft} 分钟`);

                    // 只处理未来的活动
                    if (minutesLeft < 0) continue;

                    for (const reminderTime of cfg.mainActivityReminderTimes) {
                        // 当剩余时间落在 [reminderTime-1, reminderTime] 区间时触发提醒
                        if (minutesLeft <= reminderTime && minutesLeft > reminderTime - 1) {
                            const reminderKey = `${activity.id}_${reminderTime}`;
                            if (!sentReminders.has(reminderKey)) {
                                logger.debug(`触发提醒: ${activity.themeName} - ${reminderTime} 分钟前`);
                                await sendActivityReminder(activity, minutesLeft);
                                sentReminders.add(reminderKey);
                                remindersSent++;
                            } else {
                                logger.debug(`提醒已发送过: ${activity.themeName} - ${reminderTime} 分钟前`);
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`处理活动 "${activity.themeName}" 提醒失败:`, error.message);
                }
            }

            if (remindersSent > 0) {
                logger.debug(`本轮发送了 ${remindersSent} 个活动提醒`);
            }
        }
        __name(checkAndSendActivityReminders, "checkAndSendActivityReminders");

        // 发送活动提醒详情
        async function sendActivityReminder(activity, minutesLeft) {
            try {
                // 匹配TMP活动
                const tmpEvent = todayTMPEvents.find(
                    (event) => event.name.includes(activity.themeName) || activity.themeName.includes(event.name)
                );
                logger.matching(`活动匹配: "${activity.themeName}" - 找到TMP匹配: ${!!tmpEvent}`);

                if (tmpEvent && cfg.logActivityMatching) {
                    logger.matching("TMP活动详情:", {
                        tmpName: tmpEvent.name,
                        activityName: activity.themeName,
                        server: tmpEvent.server?.name,
                        departure: `${tmpEvent.departure?.location} - ${tmpEvent.departure?.city}`,
                        arrive: `${tmpEvent.arrive?.location} - ${tmpEvent.arrive?.city}`
                    });
                }

                // 替换消息模板变量
                const replacements = {
                    name: activity.themeName || '未知活动',
                    distance: activity.distance?.toString() || '未知',
                    timeLeft: minutesLeft.toString()
                };

                // 服务器信息
                if (cfg.adminServerSource === "tmp" && tmpEvent) {
                    replacements.server = tmpEvent.server?.name || '未知服务器';
                } else {
                    replacements.server = activity.serverName || '未知服务器';
                }

                // 起点信息
                if (cfg.adminStartPointSource === "tmp" && tmpEvent) {
                    replacements.startingPoint = `${tmpEvent.departure?.location || ''} - ${tmpEvent.departure?.city || ''}`.trim() || '未知起点';
                } else {
                    replacements.startingPoint = activity.startingPoint || '未知起点';
                }

                // 终点信息
                if (cfg.adminEndPointSource === "tmp" && tmpEvent) {
                    replacements.terminalPoint = `${tmpEvent.arrive?.location || ''} - ${tmpEvent.arrive?.city || ''}`.trim() || '未知终点';
                } else {
                    replacements.terminalPoint = activity.terminalPoint || '未知终点';
                }

                // 活动横幅
                if (cfg.adminShowBanner && tmpEvent && tmpEvent.banner) {
                    replacements.banner = tmpEvent.banner;
                } else {
                    replacements.banner = "无";
                }

                // 替换模板变量
                let message = cfg.mainActivityReminderMessage;
                for (const [key, value] of Object.entries(replacements)) {
                    message = message.replace(new RegExp(`{${key}}`, "g"), value);
                }

                // 不显示横幅时移除相关内容
                if (!cfg.adminShowBanner) {
                    message = message.replace(/活动横幅:.*?\n?/, "");
                }

                // 处理换行符
                message = message.replace(/\\n/g, "\n").trim();
                const fullMessage = `@全体成员\n${message}`;

                logger.message(`准备发送活动提醒: ${activity.themeName} (${minutesLeft}分钟前)`);
                logger.debug("完整消息内容:", fullMessage);

                // 发送到所有主群
                for (const groupId of cfg.mainGroups) {
                    try {
                        await sendToGroup(groupId, fullMessage, "主群组");
                        logger.message(`已发送活动提醒到主群组 ${groupId}: ${activity.themeName}`);
                    } catch (error) {
                        logger.error(`发送活动提醒到主群组 ${groupId} 失败:`, error.message);
                    }
                }
            } catch (error) {
                logger.error(`发送活动提醒失败:`, error.message);
            }
        }
        __name(sendActivityReminder, "sendActivityReminder");

        // 发送消息到指定群组
        async function sendToGroup(groupId, message, groupType) {
            // 过滤不支持的平台
            const availableBots = ctx.bots.filter((bot) => {
                const unsupportedPlatforms = ["mail", "telegram", "discord"];
                return !unsupportedPlatforms.includes(bot.platform);
            });

            if (availableBots.length === 0) {
                throw new Error(`没有可用的聊天平台适配器（当前不支持邮件/电报/Discord）`);
            }

            let lastError = null;
            logger.debug(`尝试通过 ${availableBots.length} 个适配器发送消息到${groupType} ${groupId}`);

            // 尝试所有可用机器人发送
            for (const bot of availableBots) {
                try {
                    await bot.sendMessage(groupId, message);
                    logger.debug(`已通过 ${bot.platform} 适配器发送消息到${groupType} ${groupId}`);
                    return; // 发送成功则退出循环
                } catch (error) {
                    lastError = error;
                    logger.warn(`通过 ${bot.platform} 适配器发送消息失败: ${error.message}`);
                }
            }

            throw lastError || new Error(`所有适配器都无法发送消息到${groupType} ${groupId}`);
        }
        __name(sendToGroup, "sendToGroup");

        // 手动检查今日活动命令
        ctx.command("活动查询", "手动检查今日活动").action(async () => {
            logger.debug("手动执行活动检查命令");
            await updateActivityData();
            const result = `检查完成！\n车队平台今日活动: ${todayActivities.length} 个\nTMP今日参与活动: ${todayTMPEvents.length} 个`;
            logger.debug(result);
            return result;
        });

        // 查看调试信息命令
        ctx.command("活动DEBUG", "查看插件调试信息").action(() => {
            const state = {
                todayActivities: todayActivities.length,
                todayTMPEvents: todayTMPEvents.length,
                sentReminders: sentReminders.size,
                timers: timers.length,
                config: {
                    debugMode: cfg.debugMode,
                    logApiResponses: cfg.logApiResponses,
                    logTimingDetails: cfg.logTimingDetails,
                    logActivityMatching: cfg.logActivityMatching,
                    logMessageSending: cfg.logMessageSending
                }
            };

            let message = "📊 TMP-BOT 插件调试信息:\n";
            message += `• 今日活动: ${state.todayActivities} 个\n`;
            message += `• TMP活动: ${state.todayTMPEvents} 个\n`;
            message += `• 已发送提醒: ${state.sentReminders} 个\n`;
            message += `• 活跃定时器: ${state.timers} 个\n`;
            message += `• 调试模式: ${state.config.debugMode ? "✅ 开启" : "❌ 关闭"}\n`;
            message += `• 日志选项: API=${state.config.logApiResponses ? "✅" : "❌"}, 定时=${state.config.logTimingDetails ? "✅" : "❌"}, 匹配=${state.config.logActivityMatching ? "✅" : "❌"}, 消息=${state.config.logMessageSending ? "✅" : "❌"}`;

            return message;
        });

        // 手动重置数据命令
        ctx.command("重置数据", "手动重置今日活动数据").action(() => {
            logger.debug("手动执行数据重置命令");
            resetDailyData();
            return "✅ 今日活动数据已重置完成！";
        });

        // 插件卸载时清理资源
        ctx.on("dispose", () => {
            logger.debug("插件卸载，开始清理资源");
            todayActivities = [];
            todayTMPEvents = [];
            sentReminders.clear();
            // 清理所有定时器
            timers.forEach((timer) => {
                clearTimeout(timer);
                clearInterval(timer);
            });
            timers.length = 0;
            logger.debug("资源清理完成");
        });
    }
}
__name(apply, "apply");
0 && (module.exports = {
    Config,
    apply,
    name
});