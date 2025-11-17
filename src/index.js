"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;

const koishi_1 = require("koishi");
const model = require('./database/model');
const { MileageRankingType } = require('./util/constant');

const commands = {
    tmpQuery: require('./command/tmpQuery/tmpQuery'),
    tmpServer: require('./command/tmpServer'),
    tmpBind: require('./command/tmpBind'),
    tmpTraffic: require('./command/tmpTraffic/tmpTraffic'),
    tmpPosition: require('./command/tmpPosition'),
    tmpVersion: require('./command/tmpVersion'),
    tmpDlcMap: require('./command/tmpDlcMap'),
    tmpMileageRanking: require('./command/tmpMileageRanking'),
    resetPassword: require('./command/ets-app/resetPassword'),
    queryPoint: require('./command/ets-app/queryPoint'),
    tmpVtc: require('./command/tmpVtc')
};

const __defProp = Object.defineProperty;
const __getOwnPropDesc = Object.getOwnPropertyDescriptor;
const __getOwnPropNames = Object.getOwnPropertyNames;
const __hasOwnProp = Object.prototype.hasOwnProperty;
const __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const __export = (target, all) => {
    for (const name2 in all)
        __defProp(target, name2, { get: all[name2], enumerable: true });
};
const __copyProps = (to, from, except, desc) => {
    if (from && (typeof from === "object" || typeof from === "function")) {
        for (const key of __getOwnPropNames(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { 
                    get: () => from[key], 
                    enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable 
                });
    }
    return to;
};
const __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

const src_exports = {};
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
        mainActivityStartReminderMessage: koishi_1.Schema.string().description("活动开始提醒消息模板，支持变量：{name}, {server}, {startingPoint}, {terminalPoint}, {distance}, {banner}").default("活动 {name} 现在开始集合啦!\n服务器: {server}\n起点: {startingPoint}\n终点: {terminalPoint}\n距离: {distance}KM\n活动将于20:30分开始！"),
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

class ActivityService {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.cfg = config;
        this.todayActivities = [];
        this.todayTMPEvents = [];
        this.sentReminders = new Set();
        this.timers = [];
        this.logger = this.initLogger();
    }

    initLogger() {
        return {
            debug: (message, ...args) => {
                if (this.cfg.debugMode) {
                    this.ctx.logger.debug(`[TMP-BOT DEBUG] ${message}`, ...args);
                }
            },
            info: (message, ...args) => {
                this.ctx.logger.info(`[TMP-BOT] ${message}`, ...args);
            },
            warn: (message, ...args) => {
                this.ctx.logger.warn(`[TMP-BOT WARN] ${message}`, ...args);
            },
            error: (message, ...args) => {
                this.ctx.logger.error(`[TMP-BOT ERROR] ${message}`, ...args);
            },
            api: (message, data) => {
                if (this.cfg.logApiResponses) {
                    this.ctx.logger.info(`[TMP-BOT API] ${message}`, data ? JSON.stringify(data, null, 2) : "");
                }
            },
            timing: (message, data) => {
                if (this.cfg.logTimingDetails) {
                    this.ctx.logger.info(`[TMP-BOT TIMING] ${message}`, data || "");
                }
            },
            matching: (message, data) => {
                if (this.cfg.logActivityMatching) {
                    this.ctx.logger.info(`[TMP-BOT MATCHING] ${message}`, data || "");
                }
            },
            message: (message, data) => {
                if (this.cfg.logMessageSending) {
                    this.ctx.logger.info(`[TMP-BOT MESSAGE] ${message}`, data || "");
                }
            }
        };
    }

    start() {
        this.setupDailyTasks();
        this.registerAdminCommands();
        this.ctx.on("dispose", () => this.cleanup());
    }

    registerAdminCommands() {
        this.ctx.command("活动查询", "手动检查今日活动")
            .action(async () => {
                this.logger.debug("手动执行活动检查命令");
                await this.updateActivityData();
                return `检查完成！\n车队平台今日活动: ${this.todayActivities.length} 个\nTMP今日参与活动: ${this.todayTMPEvents.length} 个`;
            });

        this.ctx.command("活动DEBUG", "查看插件调试信息")
            .action(() => this.getDebugInfo());

        this.ctx.command("重置数据", "手动重置今日活动数据")
            .action(() => {
                this.logger.debug("手动执行数据重置命令");
                this.resetDailyData();
                return "✅ 今日活动数据已重置完成！";
            });
    }

    getDebugInfo() {
        let startRemindersSent = 0;
        for (const reminderKey of this.sentReminders) {
            if (reminderKey.endsWith('_started')) {
                startRemindersSent++;
            }
        }

        return `📊 TMP-BOT 插件调试信息:\n` +
               `• 今日活动: ${this.todayActivities.length} 个\n` +
               `• TMP活动: ${this.todayTMPEvents.length} 个\n` +
               `• 已发送提醒: ${this.sentReminders.size} 个\n` +
               `  - 活动开始提醒: ${startRemindersSent} 个\n` +
               `• 活跃定时器: ${this.timers.length} 个\n` +
               `• 调试模式: ${this.cfg.debugMode ? "✅ 开启" : "❌ 关闭"}\n` +
               `• 日志选项: API=${this.cfg.logApiResponses ? "✅" : "❌"}, 定时=${this.cfg.logTimingDetails ? "✅" : "❌"}, 匹配=${this.cfg.logActivityMatching ? "✅" : "❌"}, 消息=${this.cfg.logMessageSending ? "✅" : "❌"}`;
    }

    setupDailyTasks() {
        const now = new Date();
        const localTime = now.toLocaleString();
        const localDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const utcDate = now.toISOString().split("T")[0];
        
        this.logger.timing(`开始设置每日定时任务，本地时间: ${localTime}, 本地日期: ${localDate}, UTC日期: ${utcDate}`);
        
        const resetHour = 2;
        const resetMinute = 0;
        const resetDelay = this.getNextTime(resetHour, resetMinute);
        const resetTimer = setTimeout(() => {
            this.logger.timing("执行每日数据重置");
            this.resetDailyData();
            const dailyResetTimer = setInterval(() => {
                this.logger.timing("执行每日数据重置");
                this.resetDailyData();
            }, koishi_1.Time.day);
            this.timers.push(dailyResetTimer);
        }, resetDelay);
        this.timers.push(resetTimer);
        this.logger.timing(`设置数据重置定时器: ${resetHour}:${resetMinute.toString().padStart(2, "0")}, 延迟: ${resetDelay}ms`);
        
        this.cfg.adminCheckTimes.forEach((timeStr, index) => {
            const [hours, minutes] = timeStr.split(":").map(Number);
            this.setupTimer(hours, minutes, () => {
                this.logger.timing(`执行定时检查任务 #${index + 1} (${timeStr})`);
                this.updateActivityData();
            }, `检查定时器 #${index + 1}: ${timeStr}`);
        });

        this.cfg.adminSendTimes.forEach((timeStr, index) => {
            const [hours, minutes] = timeStr.split(":").map(Number);
            this.setupTimer(hours, minutes, () => {
                this.logger.timing(`执行定时发送任务 #${index + 1} (${timeStr})`);
                this.checkAndSendProfileReminders();
            }, `发送定时器 #${index + 1}: ${timeStr}`);
        });

        const minuteTimer = setInterval(async () => {
            await this.checkAndSendActivityReminders();
        }, koishi_1.Time.minute);
        this.timers.push(minuteTimer);
        this.logger.timing("设置每分钟检查定时器");
        this.logger.debug("启动时立即更新活动数据");
        this.updateActivityData();
    }

    setupTimer(hours, minutes, callback, name) {
        const delay = this.getNextTime(hours, minutes);
        const timer = setTimeout(() => {
            callback();
            const dailyTimer = setInterval(callback, koishi_1.Time.day);
            this.timers.push(dailyTimer);
        }, delay);
        this.timers.push(timer);
        this.logger.timing(`${name}, 延迟: ${delay}ms`);
    }

    getNextTime(hours, minutes) {
        const now = new Date();
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

    resetDailyData() {
        const now = new Date();
        const localTime = now.toLocaleString();
        const localDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const utcDate = now.toISOString().split("T")[0];
        
        const previousActivityCount = this.todayActivities.length;
        const previousTMPCount = this.todayTMPEvents.length;
        const previousReminderCount = this.sentReminders.size;
        
        this.logger.info(`[数据重置] 开始重置数据，本地时间: ${localTime}, 本地日期: ${localDate}, UTC日期: ${utcDate}`);
        this.logger.info(`[数据重置] 重置前数据: 活动${previousActivityCount}个, TMP${previousTMPCount}个, 提醒${previousReminderCount}个`);
        
        this.todayActivities = [];
        this.todayTMPEvents = [];
        this.sentReminders.clear();
        
        this.logger.info(`[数据重置] 每日数据已重置: 活动${previousActivityCount}→0, TMP${previousTMPCount}→0, 提醒${previousReminderCount}→0`);
        
        this.updateActivityData().then(() => {
            this.logger.info(`[数据重置] 重置后数据更新完成: 活动${this.todayActivities.length}个, TMP${this.todayTMPEvents.length}个`);
        }).catch(error => {
            this.logger.error(`[数据重置] 重置后数据更新失败:`, error.message);
        });
    }

    async updateActivityData() {
        try {
            this.logger.debug("开始更新活动数据");
            const startTime = Date.now();
            await Promise.all([
                this.updateTodayActivities(),
                this.updateTodayTMPEvents()
            ]);
            
            const duration = Date.now() - startTime;
            this.logger.info(`活动数据更新完成，耗时: ${duration}ms`);
            this.logger.debug(`今日活动数量: ${this.todayActivities.length}, TMP活动数量: ${this.todayTMPEvents.length}`);
        } catch (error) {
            this.logger.error("更新活动数据失败:", error.message);
        }
    }

    async updateTodayActivities() {
        try {
            this.todayActivities = [];
            
            const protocol = this.cfg.adminUseHttps ? "https://" : "http://";
            const fullUrl = `${protocol}${this.cfg.adminApiUrl}/api/activity/info/list?token=${this.cfg.adminApiToken}&page=1&limit=50&themeName=`;
            this.logger.api(`请求车队平台API: ${fullUrl.replace(this.cfg.adminApiToken, "***")}`);

            const startTime = Date.now();
            const response = await this.ctx.http.get(fullUrl, { timeout: 10000 });
            const duration = Date.now() - startTime;
            this.logger.api(`车队平台API响应耗时: ${duration}ms, 状态码: ${response.code}`);

            if (this.cfg.logApiResponses) {
                this.logger.api("车队平台API响应详情:", {
                    code: response.code,
                    totalCount: response.data?.totalCount,
                    listCount: response.data?.list?.length
                });
            }

            if (response.code === 0 && response.data?.list) {
                const now = new Date();
                const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                this.logger.debug(`[活动更新] 当前本地日期: ${today}, UTC日期: ${new Date().toISOString().split("T")[0]}`);
                
                const originalCount = response.data.list.length;
                this.logger.debug(`[活动更新] API返回活动总数: ${originalCount}`);
                if (this.cfg.debugMode && originalCount > 0) {
                    const activityDates = response.data.list.map(a => `${a.themeName}: ${a.startTime?.split(" ")[0]}`);
                    this.logger.debug(`[活动更新] 所有活动日期:`, activityDates);
                }
                
                this.todayActivities = response.data.list.filter((activity) => {
                    const activityDate = activity.startTime?.split(" ")[0];
                    const isToday = activityDate === today;
                    if (!isToday && this.cfg.debugMode) {
                        this.logger.debug(`[活动更新] 跳过非今日活动: ${activity.themeName}, 日期: ${activityDate}, 当前日期: ${today}`);
                    }
                    return isToday;
                });
                
                this.logger.info(`[活动更新] 从车队平台找到 ${this.todayActivities.length}/${originalCount} 个今日活动`);
                if (this.cfg.debugMode && this.todayActivities.length > 0) {
                    const todayActivityNames = this.todayActivities.map(a => `${a.themeName}: ${a.startTime}`);
                    this.logger.debug(`[活动更新] 今日活动详情:`, todayActivityNames);
                }
            } else {
                this.logger.error(`[活动更新] 车队平台API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                this.todayActivities = [];
            }
        } catch (error) {
            this.logger.error("[活动更新] 获取车队平台活动列表失败:", error.message);
            this.todayActivities = [];
        }
    }

    async updateTodayTMPEvents() {
        try {
            this.todayTMPEvents = [];
            
            if (!this.cfg.adminVtcId) {
                this.logger.warn("[TMP活动更新] TMP API请求失败：未配置adminVtcId");
                return;
            }
            
            const tmpApiUrl = `https://api.truckersmp.com/v2/vtc/${this.cfg.adminVtcId}/events/attending/`;
            this.logger.api(`[TMP活动更新] 请求TMP API: ${tmpApiUrl}`);

            const startTime = Date.now();
            const response = await this.ctx.http.get(tmpApiUrl, { timeout: 10000 });
            const duration = Date.now() - startTime;
            this.logger.api(`[TMP活动更新] TMP API响应耗时: ${duration}ms, 错误状态: ${response.error}`);

            if (!response.error && Array.isArray(response.response)) {
                const now = new Date();
                const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                this.logger.debug(`[TMP活动更新] 当前本地日期: ${today}, UTC日期: ${new Date().toISOString().split("T")[0]}`);
                
                const originalCount = response.response.length;
                this.logger.debug(`[TMP活动更新] API返回活动总数: ${originalCount}`);
                
                if (this.cfg.debugMode && originalCount > 0) {
                    const eventDates = response.response.map(e => `${e.name}: ${e.start_at?.split(" ")[0]}`);
                    this.logger.debug(`[TMP活动更新] 所有活动日期:`, eventDates);
                }
                
                this.todayTMPEvents = response.response.filter((event) => {
                    const eventDate = event.start_at?.split(" ")[0];
                    const isToday = eventDate === today;
                    if (!isToday && this.cfg.debugMode) {
                        this.logger.debug(`[TMP活动更新] 跳过非今日活动: ${event.name}, 日期: ${eventDate}, 当前日期: ${today}`);
                    }
                    return isToday;
                });
                
                this.logger.info(`[TMP活动更新] 从TMP找到 ${this.todayTMPEvents.length}/${originalCount} 个今日活动`);
                
                if (this.cfg.debugMode && this.todayTMPEvents.length > 0) {
                    const todayEventNames = this.todayTMPEvents.map(e => `${e.name}: ${e.start_at}`);
                    this.logger.debug(`[TMP活动更新] 今日活动详情:`, todayEventNames);
                }
            } else {
                this.logger.error(`[TMP活动更新] TMP API返回错误: ${response.message || '未知错误'}`);
            }
        } catch (error) {
            this.logger.error("[TMP活动更新] 获取TMP活动失败:", error.message);
        }
    }

    async checkAndSendProfileReminders() {
        if (this.todayActivities.length === 0) {
            this.logger.debug("今日没有活动，跳过档位检查");
            return;
        }
        
        this.logger.debug(`开始检查 ${this.todayActivities.length} 个活动的档位状态`);

        for (const activity of this.todayActivities) {
            const hasProfile = !!activity.profileFile;
            const message = hasProfile ? this.cfg.adminProfileUploadedMessage : this.cfg.adminProfileNotUploadedMessage;
            const fullMessage = `活动 "${activity.themeName || '未知活动'}" - ${message}`;
            this.logger.message(`活动档位检查: "${activity.themeName || '未知活动'}" - ${hasProfile ? "已上传" : "未上传"}`);

            for (const groupId of this.cfg.adminGroups) {
                try {
                    await this.sendToGroup(groupId, fullMessage, "管理群组");
                    this.logger.message(`已发送档位提醒到管理群组 ${groupId}: ${activity.themeName || '未知活动'}`);
                } catch (error) {
                    this.logger.error(`发送消息到管理群组 ${groupId} 失败:`, error.message);
                }
            }
        }
    }

    async checkAndSendActivityReminders() {
        const now = new Date();
        const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const todayUTC = now.toISOString().split("T")[0];
        let remindersSent = 0;
        this.logger.debug(`检查 ${this.todayActivities.length} 个活动的提醒时间，当前本地日期: ${today}, UTC日期: ${todayUTC}`);

        for (const activity of this.todayActivities) {
            try {
                const activityDate = activity.startTime?.split(" ")[0];
                if (activityDate !== today) {
                    this.logger.debug(`跳过非今日活动 "${activity.themeName}"，活动日期: ${activityDate}，当前本地日期: ${today}`);
                    continue;
                }

                const activityStartTime = new Date(activity.startTime);
                if (isNaN(activityStartTime.getTime())) {
                    this.logger.warn(`活动 "${activity.themeName}" 开始时间格式错误，跳过提醒`);
                    continue;
                }

                const timeDiff = activityStartTime.getTime() - now.getTime();
                const totalSecondsLeft = Math.floor(timeDiff / 1000);
                const minutesLeft = Math.floor(totalSecondsLeft / 60);
                const secondsLeft = totalSecondsLeft % 60;
                this.logger.debug(`活动 "${activity.themeName}" 剩余时间: ${minutesLeft} 分 ${secondsLeft} 秒`);
                if (totalSecondsLeft >= -30 && totalSecondsLeft <= 0) {
                    const startReminderKey = `${activity.id}_started`;
                    if (!this.sentReminders.has(startReminderKey)) {
                        this.logger.debug(`触发活动开始提醒: ${activity.themeName}`);
                        await this.sendActivityStartReminder(activity);
                        this.sentReminders.add(startReminderKey);
                        remindersSent++;
                    }
                }
                if (totalSecondsLeft < 0) continue;
                for (const reminderTime of this.cfg.mainActivityReminderTimes) {
                    const reminderTimeSeconds = reminderTime * 60;
                    if (totalSecondsLeft <= reminderTimeSeconds && totalSecondsLeft > reminderTimeSeconds - 30) {
                        const reminderKey = `${activity.id}_${reminderTime}`;
                        if (!this.sentReminders.has(reminderKey)) {
                            this.logger.debug(`触发提醒: ${activity.themeName} - ${reminderTime} 分钟前`);
                            await this.sendActivityReminder(activity, minutesLeft);
                            this.sentReminders.add(reminderKey);
                            remindersSent++;
                        }
                    }
                }
            } catch (error) {
                this.logger.error(`处理活动 "${activity.themeName}" 提醒失败:`, error.message);
            }
        }

        if (remindersSent > 0) {
            this.logger.debug(`本轮发送了 ${remindersSent} 个活动提醒`);
        }
    }

    createActivityReplacements(activity, tmpEvent, minutesLeft) {
        const replacements = {
            name: activity.themeName || '未知活动',
            distance: activity.distance?.toString() || '未知'
        };

        if (minutesLeft !== undefined) {
            replacements.timeLeft = minutesLeft.toString();
        }

        if (this.cfg.adminServerSource === "tmp" && tmpEvent) {
            replacements.server = tmpEvent.server?.name || '未知服务器';
        } else {
            replacements.server = activity.serverName || '未知服务器';
        }

        if (this.cfg.adminStartPointSource === "tmp" && tmpEvent) {
            replacements.startingPoint = `${tmpEvent.departure?.location || ''} - ${tmpEvent.departure?.city || ''}`.trim() || '未知起点';
        } else {
            replacements.startingPoint = activity.startingPoint || '未知起点';
        }

        if (this.cfg.adminEndPointSource === "tmp" && tmpEvent) {
            replacements.terminalPoint = `${tmpEvent.arrive?.location || ''} - ${tmpEvent.arrive?.city || ''}`.trim() || '未知终点';
        } else {
            replacements.terminalPoint = activity.terminalPoint || '未知终点';
        }

        if (this.cfg.adminShowBanner && tmpEvent && tmpEvent.banner) {
            replacements.banner = tmpEvent.banner;
        } else {
            replacements.banner = "无";
        }

        return replacements;
    }

    async sendActivityStartReminder(activity) {
        try {
            const tmpEvent = this.todayTMPEvents.find(
                (event) => event.name.includes(activity.themeName) || activity.themeName.includes(event.name)
            );
            this.logger.matching(`活动匹配: "${activity.themeName}" - 找到TMP匹配: ${!!tmpEvent}`);

            const replacements = this.createActivityReplacements(activity, tmpEvent);
            
            let message = this.cfg.mainActivityStartReminderMessage;
            for (const [key, value] of Object.entries(replacements)) {
                message = message.replace(new RegExp(`{${key}}`, "g"), value);
            }

            if (!this.cfg.adminShowBanner) {
                message = message.replace(/活动横幅:.*?\n?/, "");
            }

            message = message.replace(/\\n/g, "\n").trim();
            const fullMessage = `@全体成员\n${message}`;
            
            await this.sendToMainGroups(fullMessage, activity.themeName, "开始提醒");
        } catch (error) {
            this.logger.error(`发送活动开始提醒失败:`, error.message);
        }
    }

    async sendActivityReminder(activity, minutesLeft) {
        try {
            const tmpEvent = this.todayTMPEvents.find(
                (event) => event.name.includes(activity.themeName) || activity.themeName.includes(event.name)
            );
            this.logger.matching(`活动匹配: "${activity.themeName}" - 找到TMP匹配: ${!!tmpEvent}`);

            const replacements = this.createActivityReplacements(activity, tmpEvent, minutesLeft);
            
            let message = this.cfg.mainActivityReminderMessage;
            for (const [key, value] of Object.entries(replacements)) {
                message = message.replace(new RegExp(`{${key}}`, "g"), value);
            }

            if (!this.cfg.adminShowBanner) {
                message = message.replace(/活动横幅:.*?\n?/, "");
            }

            message = message.replace(/\\n/g, "\n").trim();
            const fullMessage = `@全体成员\n${message}`;
            
            await this.sendToMainGroups(fullMessage, activity.themeName, `${minutesLeft}分钟前提醒`);
        } catch (error) {
            this.logger.error(`发送活动提醒失败:`, error.message);
        }
    }

    async sendToMainGroups(message, activityName, reminderType) {
        for (const groupId of this.cfg.mainGroups) {
            try {
                await this.sendToGroup(groupId, message, "主群组");
                this.logger.message(`已发送${reminderType}到主群组 ${groupId}: ${activityName}`);
            } catch (error) {
                this.logger.error(`发送${reminderType}到主群组 ${groupId} 失败:`, error.message);
            }
        }
    }

    async sendToGroup(groupId, message, groupType) {
        const availableBots = this.ctx.bots.filter((bot) => {
            const unsupportedPlatforms = ["mail", "telegram", "discord"];
            return !unsupportedPlatforms.includes(bot.platform);
        });

        if (availableBots.length === 0) {
            throw new Error(`没有可用的聊天平台适配器（当前不支持邮件/电报/Discord）`);
        }

        let lastError = null;
        this.logger.debug(`尝试通过 ${availableBots.length} 个适配器发送消息到${groupType} ${groupId}`);

        for (const bot of availableBots) {
            try {
                await bot.sendMessage(groupId, message);
                this.logger.debug(`已通过 ${bot.platform} 适配器发送消息到${groupType} ${groupId}`);
                return;
            } catch (error) {
                lastError = error;
                this.logger.warn(`通过 ${bot.platform} 适配器发送消息失败: ${error.message}`);
            }
        }

        throw lastError || new Error(`所有适配器都无法发送消息到${groupType} ${groupId}`);
    }

    cleanup() {
        this.logger.debug("插件卸载，开始清理资源");
        this.todayActivities = [];
        this.todayTMPEvents = [];
        this.sentReminders.clear();
        this.timers.forEach((timer) => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        this.timers.length = 0;
        this.logger.debug("资源清理完成");
    }
}

function registerBaseCommands(ctx, cfg) {
    ctx.command('查询 <tmpId>')
        .action(async ({ session }, tmpId) => await commands.tmpQuery(ctx, cfg, session, tmpId));
        
    ctx.command('美卡服务器')
        .action(async () => await commands.tmpServer(ctx, cfg, 'ATS'));
        
    ctx.command('欧卡服务器')
        .action(async () => await commands.tmpServer(ctx, cfg, 'ETS2'));
        
    ctx.command('绑定 <tmpId>')
        .action(async ({ session }, tmpId) => await commands.tmpBind(ctx, cfg, session, tmpId));
        
    ctx.command('路况 <serverName>')
        .action(async ({ session }, serverName) => await commands.tmpTraffic(ctx, cfg, serverName));
        
    ctx.command('定位 <tmpId>')
        .action(async ({ session }, tmpId) => await commands.tmpPosition(ctx, cfg, session, tmpId));
        
    ctx.command('tmp版本')
        .action(async () => await commands.tmpVersion(ctx));
        
    ctx.command('地图dlc价格')
        .action(async ({ session }) => await commands.tmpDlcMap(ctx, session));
        
    ctx.command('里程排行榜')
        .action(async ({ session }) => await commands.tmpMileageRanking(ctx, session, MileageRankingType.total));
        
    ctx.command('今日里程排行榜')
        .action(async ({ session }) => await commands.tmpMileageRanking(ctx, session, MileageRankingType.today));
        
    ctx.command('vtc查询 <vtcid>')
        .action(async ({ session }, vtcid) => await commands.tmpVtc(ctx, cfg, session, vtcid));
        
    ctx.command(`重置密码 [targetTeamId:string]`, "重置欧卡车队平台密码")
        .usage("重置自己的密码，或管理员重置指定teamId的密码")
        .example(`重置密码new - 重置自己的密码`)
        .example(`重置密码new 123 - 管理员重置指定teamId的密码`)
        .action(async ({ session }, targetTeamId) => await commands.resetPassword(ctx, cfg, session, targetTeamId));
        
    ctx.command(`查询积分 [targetQQ:string]`, "查询欧卡车队平台积分")
        .usage("查询自己或指定QQ号的积分，在群聊中可@他人查询")
        .example(`查询积分 - 查询自己的积分`)
        .example(`查询积分 123456 - 查询指定QQ号的积分`)
        .action(async ({ session }, targetQQ) => await commands.queryPoint(ctx, cfg, session, targetQQ));
        
    ctx.command('规则查询')
        .action(async () => 'TruckersMP官方规则链接：https://truckersmp.com/knowledge-base/article/746');
}

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

    registerBaseCommands(ctx, cfg);

    if (cfg.activityQuertEnable) {
        const activityService = new ActivityService(ctx, cfg);
        activityService.start();
    } else if (cfg.debugMode) {
        ctx.logger.debug("[TMP-BOT] 活动查询功能已禁用");
    }
}
__name(apply, "apply");
0 && (module.exports = {
    Config,
    apply,
    name
});