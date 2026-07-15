"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;

const koishi_1 = require("koishi");

const v1Methods = require('./tmpActivityService/tmpActivityServiceV1');
const v2Methods = require('./tmpActivityService/tmpActivityServiceV2');

class ActivityService {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.cfg = config;
        this.todayActivities = [];
        this.todayTMPEvents = [];
        this.sentReminders = new Set();
        this.sentNoActivityNotification = false;
        this.timers = [];
        this.logger = this.initLogger();

        const platformVersion = (this.cfg.mainSettings?.platformVersion || "v1").toLowerCase();
        if (platformVersion === "v2") {
            Object.assign(this, v2Methods);
        } else {
            Object.assign(this, v1Methods);
        }
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
                if (this.cfg.debug?.logApiResponses) {
                    this.ctx.logger.info(`[TMP-BOT API] ${message}`, data ? JSON.stringify(data, null, 2) : "");
                }
            },
            timing: (message, data) => {
                if (this.cfg.debug?.logTimingDetails) {
                    this.ctx.logger.info(`[TMP-BOT TIMING] ${message}`, data || "");
                }
            },
            matching: (message, data) => {
                if (this.cfg.debug?.logActivityMatching) {
                    this.ctx.logger.info(`[TMP-BOT MATCHING] ${message}`, data || "");
                }
            },
            message: (message, data) => {
                if (this.cfg.debug?.logMessageSending) {
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

        this.ctx.command("重置数据", "手动重置今日活动数据")
            .action(() => {
                this.logger.debug("手动执行数据重置命令");
                this.resetDailyData();
                return "✅ 今日活动数据已重置完成！";
            });
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

        this.cfg.admin.checkTimes.forEach((timeStr, index) => {
            const [hours, minutes] = timeStr.split(":").map(Number);
            this.setupTimer(hours, minutes, async () => {
                this.logger.timing(`执行定时检查任务 #${index + 1} (${timeStr})`);
                await this.updateActivityData();
                await this.checkActivityStatusChange();
            }, `检查定时器 #${index + 1}: ${timeStr}`);
        });

        this.cfg.admin.sendTimes.forEach((timeStr, index) => {
            const [hours, minutes] = timeStr.split(":").map(Number);
            this.setupTimer(hours, minutes, async () => {
                this.logger.timing(`执行定时发送任务 #${index + 1} (${timeStr})`);
                await this.checkAndSendProfileReminders();
            }, `发送定时器 #${index + 1}: ${timeStr}`);
        });

        this.cfg.admin.autoClockCheckTimes.forEach((timeStr, index) => {
            const [hours, minutes] = timeStr.split(":").map(Number);
            this.setupTimer(hours, minutes, async () => {
                this.logger.timing(`执行自动打卡检查任务 #${index + 1} (${timeStr})`);
                await this.checkAutoClockStatus();
            }, `自动打卡检查定时器 #${index + 1}: ${timeStr}`);
        });

        if (this.cfg.noActivity?.enable) {
            const [noActivityHours, noActivityMinutes] = this.cfg.noActivity.time.split(":").map(Number);
            this.setupTimer(noActivityHours, noActivityMinutes, () => {
                this.logger.timing(`执行今日无活动通知任务 (${this.cfg.noActivity.time})`);
                this.checkAndSendNoActivityNotification();
            }, `无活动通知定时器: ${this.cfg.noActivity.time}`);
        }

        if (this.cfg.onlineCheck?.enable) {
            const [onlineHours, onlineMinutes] = this.cfg.onlineCheck.time.split(":").map(Number);
            this.setupTimer(onlineHours, onlineMinutes, () => {
                this.logger.timing(`执行在线成员检查任务 (${this.cfg.onlineCheck.time})`);
                this.checkAndSendOnlineMemberReport();
            }, `在线成员检查定时器: ${this.cfg.onlineCheck.time}`);
        }

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
        const previousNoActivityNotification = this.sentNoActivityNotification;

        this.logger.info(`[数据重置] 开始重置数据，本地时间: ${localTime}, 本地日期: ${localDate}, UTC日期: ${utcDate}`);
        this.logger.info(`[数据重置] 重置前数据: 活动${previousActivityCount}个, TMP${previousTMPCount}个, 提醒${previousReminderCount}个, 无活动通知${previousNoActivityNotification ? "已发送" : "未发送"}`);

        this.todayActivities = [];
        this.todayTMPEvents = [];
        this.sentReminders.clear();
        this.sentNoActivityNotification = false;

        this.logger.info(`[数据重置] 每日数据已重置: 活动${previousActivityCount}→0, TMP${previousTMPCount}→0, 提醒${previousReminderCount}→0, 无活动通知${previousNoActivityNotification ? "已发送" : "未发送"}→未发送`);

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

    async updateTodayTMPEvents() {
        try {
            this.todayTMPEvents = [];

            if (!this.cfg.api.vtcId) {
                this.logger.warn("[TMP活动更新] TMP API请求失败：未配置api.vtcId");
                return;
            }

            const tmpApiUrl = `https://api.truckersmp.com/v2/vtc/${this.cfg.api.vtcId}/events/attending/`;
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

                if (this.cfg.debug?.debugMode && originalCount > 0) {
                    const eventDates = response.response.map(e => `${e.name}: ${e.start_at?.split(" ")[0]}`);
                    this.logger.debug(`[TMP活动更新] 所有活动日期:`, eventDates);
                }

                this.todayTMPEvents = response.response.filter((event) => {
                    const eventDate = event.start_at?.split(" ")[0];
                    const isToday = eventDate === today;
                    if (!isToday && this.cfg.debug?.debugMode) {
                        this.logger.debug(`[TMP活动更新] 跳过非今日活动: ${event.name}, 日期: ${eventDate}, 当前日期: ${today}`);
                    }
                    return isToday;
                });

                this.logger.info(`[TMP活动更新] 从TMP找到 ${this.todayTMPEvents.length}/${originalCount} 个今日活动`);

                if (this.cfg.debug?.debugMode && this.todayTMPEvents.length > 0) {
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
        await this.updateActivityData();

        if (this.todayActivities.length === 0) {
            this.logger.debug("今日没有活动，跳过档位检查");
            return;
        }

        this.logger.debug(`开始检查 ${this.todayActivities.length} 个活动的档位状态`);

        for (const activity of this.todayActivities) {
            const hasProfile = !!activity.profileFile;
            const message = hasProfile ? this.cfg.messages.profileUploaded : this.cfg.messages.profileNotUploaded;
            const fullMessage = `活动 "${activity.themeName || '未知活动'}" - ${message}`;
            this.logger.message(`活动档位检查: "${activity.themeName || '未知活动'}" - ${hasProfile ? "已上传" : "未上传"}`);

            for (const groupId of this.cfg.admin.groups) {
                try {
                    await this.sendToGroup(groupId, fullMessage, "管理群组");
                    this.logger.message(`已发送档位提醒到管理群组 ${groupId}: ${activity.themeName || '未知活动'}`);
                } catch (error) {
                    this.logger.error(`发送消息到管理群组 ${groupId} 失败:`, error.message);
                }
            }
        }
    }

    async checkAndSendNoActivityNotification(manualTest = false) {
        if (!manualTest && this.sentNoActivityNotification) {
            this.logger.debug("今日已发送过无活动通知，跳过");
            return;
        }

        if (this.todayActivities.length > 0 || this.todayTMPEvents.length > 0) {
            this.logger.debug(`今日有活动（车队平台: ${this.todayActivities.length}个, TMP: ${this.todayTMPEvents.length}个），不发送无活动通知`);
            return;
        }

        this.logger.info(`${manualTest ? "手动测试" : "自动"}今日无活动，发送通知到管理群`);

        for (const groupId of this.cfg.admin.groups) {
            try {
                await this.sendToGroup(groupId, this.cfg.noActivity.message, "管理群组");
                this.logger.message(`已发送无活动通知到管理群组 ${groupId}`);
            } catch (error) {
                this.logger.error(`发送无活动通知到管理群组 ${groupId} 失败:`, error.message);
            }
        }

        if (!manualTest) {
            this.sentNoActivityNotification = true;
            this.logger.debug("已标记今日无活动通知为已发送");
        }
    }

    async checkActivityStatusChange() {
        await this.updateActivityData();
        if (this.sentNoActivityNotification && (this.todayActivities.length > 0 || this.todayTMPEvents.length > 0)) {
            this.logger.info(`检测到活动状态变化：之前无活动，现在有活动（车队平台: ${this.todayActivities.length}个, TMP: ${this.todayTMPEvents.length}个）`);
            this.sentNoActivityNotification = false;
            await this.checkAndSendProfileReminders();
        }
    }

    async checkAndSendOnlineMemberReport(manualTest = false) {
        try {
            if (this.todayActivities.length === 0 && this.todayTMPEvents.length === 0) {
                this.logger.info(`[在线成员检查] 今日无活动，跳过在线成员检查`);
                return;
            }

            const apiUrl = this.cfg.onlineCheck?.apiUrl;
            if (!apiUrl) {
                this.logger.error(`[在线成员检查] 未配置API地址`);
                return;
            }

            this.logger.api(`[在线成员检查] 请求在线成员API: ${apiUrl}`);
            const startTime = Date.now();
            const response = await this.ctx.http.get(apiUrl, { timeout: 10000 });
            const duration = Date.now() - startTime;
            this.logger.api(`[在线成员检查] API响应耗时: ${duration}ms, code: ${response.code}`);

            if (response.code !== 200 || !Array.isArray(response.data)) {
                this.logger.error(`[在线成员检查] API返回错误: ${response.msg || '未知错误'} (code: ${response.code})`);
                return;
            }

            const onlineMembers = response.data.filter(member => member.isOnline === true);
            this.logger.info(`[在线成员检查] 总成员数: ${response.data.length}, 在线成员数: ${onlineMembers.length}`);

            if (onlineMembers.length === 0) {
                this.logger.info(`[在线成员检查] 当前无在线成员`);
                return;
            }

            let message = `🎮 今日活动在线成员 (${onlineMembers.length}人)\n`;
            message += `━━━━━━━━━━━━━━━━\n`;
            onlineMembers.forEach((member, index) => {
                message += `${index + 1}. ${member.name}\n`;
                message += `   TMP ID: ${member.tmpId}\n`;
                message += `   服务器: ${member.serverName || '未知'}\n`;
                message += `   更新时间: ${member.updateTime || '未知'}\n`;
            });

            for (const groupId of this.cfg.admin.groups) {
                try {
                    await this.sendToGroup(groupId, message, "管理群组");
                    this.logger.message(`[在线成员检查] 已发送在线成员报告到管理群组 ${groupId}`);
                } catch (error) {
                    this.logger.error(`[在线成员检查] 发送到管理群组 ${groupId} 失败:`, error.message);
                }
            }
        } catch (error) {
            this.logger.error(`[在线成员检查] 失败:`, error.message);
        }
    }

    async checkAndSendActivityReminders() {
        const now = new Date();
        const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const todayUTC = now.toISOString().split("T")[0];
        let remindersSent = 0;
        this.logger.debug(`检查 ${this.todayActivities.length} 个活动的提醒时间，当前本地日期: ${today}, UTC日期: ${todayUTC}`);

        if (this.cfg.mainGroup.groups.length === 0) {
            this.logger.warn(`未配置主群组ID (mainGroup.groups为空)，活动提醒将无法发送`);
        } else {
            this.logger.debug(`已配置 ${this.cfg.mainGroup.groups.length} 个主群组: ${this.cfg.mainGroup.groups.join(', ')}`);
        }

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
                this.logger.debug(`活动 "${activity.themeName}" 时间检查: totalSecondsLeft=${totalSecondsLeft}, 触发条件: -300 <= ${totalSecondsLeft} <= 0`);

                if (totalSecondsLeft >= -300 && totalSecondsLeft <= 0) {
                    const startReminderKey = `${activity.id}_started`;
                    if (!this.sentReminders.has(startReminderKey)) {
                        this.logger.info(`触发活动开始提醒: ${activity.themeName}`);
                        await this.sendActivityStartReminder(activity);
                        this.sentReminders.add(startReminderKey);
                        remindersSent++;
                    } else {
                        this.logger.debug(`活动 "${activity.themeName}" 开始提醒已发送过，跳过`);
                    }
                } else {
                    this.logger.debug(`活动 "${activity.themeName}" 未满足开始提醒条件，当前剩余 ${totalSecondsLeft} 秒`);
                }

                if (totalSecondsLeft < 0) continue;
                for (const reminderTime of this.cfg.mainGroup.activityReminderTimes) {
                    const reminderTimeSeconds = reminderTime * 60;
                    this.logger.debug(`活动 "${activity.themeName}" ${reminderTime}分钟前提醒检查: totalSecondsLeft=${totalSecondsLeft}, reminderTimeSeconds=${reminderTimeSeconds}, 条件: ${reminderTimeSeconds - 60} <= ${totalSecondsLeft} <= ${reminderTimeSeconds}`);
                    if (totalSecondsLeft <= reminderTimeSeconds && totalSecondsLeft > reminderTimeSeconds - 60) {
                        const reminderKey = `${activity.id}_${reminderTime}`;
                        if (!this.sentReminders.has(reminderKey)) {
                            this.logger.info(`触发活动前提醒: ${activity.themeName} - ${reminderTime} 分钟前`);
                            await this.sendActivityReminder(activity, reminderTime);
                            this.sentReminders.add(reminderKey);
                            remindersSent++;
                        } else {
                            this.logger.debug(`活动 "${activity.themeName}" ${reminderTime}分钟前提醒已发送过，跳过`);
                        }
                    }
                }
            } catch (error) {
                this.logger.error(`处理活动 "${activity.themeName}" 提醒失败:`, error.message);
            }
        }

        if (remindersSent > 0) {
            this.logger.info(`本轮发送了 ${remindersSent} 个活动提醒`);
        } else {
            this.logger.debug(`本轮未发送任何活动提醒`);
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

        if (this.cfg.dataSource.serverSource === "tmp" && tmpEvent) {
            replacements.server = tmpEvent.server?.name || '未知服务器';
        } else {
            replacements.server = activity.serverName || '未知服务器';
        }

        if (this.cfg.dataSource.startPointSource === "tmp" && tmpEvent) {
            replacements.startingPoint = `${tmpEvent.departure?.location || ''} - ${tmpEvent.departure?.city || ''}`.trim() || '未知起点';
        } else {
            replacements.startingPoint = activity.startingPoint || '未知起点';
        }

        if (this.cfg.dataSource.endPointSource === "tmp" && tmpEvent) {
            replacements.terminalPoint = `${tmpEvent.arrive?.location || ''} - ${tmpEvent.arrive?.city || ''}`.trim() || '未知终点';
        } else {
            replacements.terminalPoint = activity.terminalPoint || '未知终点';
        }

        if (this.cfg.dataSource.showBanner && tmpEvent && tmpEvent.banner) {
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

            let message = this.cfg.mainGroup.activityStartReminderMessage;
            for (const [key, value] of Object.entries(replacements)) {
                message = message.replace(new RegExp(`{${key}}`, "g"), value);
            }

            if (!this.cfg.dataSource.showBanner) {
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

            let message = this.cfg.mainGroup.activityReminderMessage;
            for (const [key, value] of Object.entries(replacements)) {
                message = message.replace(new RegExp(`{${key}}`, "g"), value);
            }

            if (!this.cfg.dataSource.showBanner) {
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
        for (const groupId of this.cfg.mainGroup.groups) {
            try {
                await this.sendToGroup(groupId, message, "主群组");
                this.logger.message(`已发送${reminderType}到主群组 ${groupId}: ${activityName}`);
            } catch (error) {
                this.logger.error(`发送${reminderType}到主群组 ${groupId} 失败:`, error.message);
            }
        }
    }

    async sendToGroup(groupId, message, groupType) {
        const onebotBots = this.ctx.bots.filter((bot) => {
            return bot.platform === "onebot";
        });

        if (onebotBots.length === 0) {
            throw new Error(`请启用onebot适配器以发送${groupType}消息`);
        }

        let lastError = null;
        this.logger.debug(`尝试通过 ${onebotBots.length} 个onebot适配器发送消息到${groupType} ${groupId}`);

        for (const bot of onebotBots) {
            try {
                await bot.sendMessage(groupId, message);
                this.logger.debug(`已通过 ${bot.platform} 适配器发送消息到${groupType} ${groupId}`);
                return;
            } catch (error) {
                lastError = error;
                this.logger.warn(`通过 ${bot.platform} 适配器发送消息失败: ${error.message}`);
            }
        }

        throw lastError || new Error(`所有onebot适配器都无法发送消息到${groupType} ${groupId}`);
    }

    async checkAutoClockStatus() {
        await this.updateActivityData();

        if (this.todayActivities.length === 0) {
            this.logger.debug("今日没有活动，跳过自动打卡检查");
            return;
        }

        this.logger.debug(`开始检查 ${this.todayActivities.length} 个活动的自动打卡状态`);

        for (const activity of this.todayActivities) {
            try {
                const autoClockEnabled = await this.checkAutoClock(activity);

                const message = autoClockEnabled
                    ? `今日活动自动打卡已设置`
                    : `请注意，今日活动打卡未设置。\n 活动名称： ${activity.themeName || '未知活动'}`;

                this.logger.message(`自动打卡检查: "${activity.themeName || '未知活动'}" - ${autoClockEnabled ? "已设置" : "未设置"}`);

                for (const groupId of this.cfg.admin.groups) {
                    try {
                        await this.sendToGroup(groupId, message, "管理群组");
                        this.logger.message(`已发送自动打卡检查到管理群组 ${groupId}: ${activity.themeName || '未知活动'}`);
                    } catch (error) {
                        this.logger.error(`发送自动打卡检查到管理群组 ${groupId} 失败:`, error.message);
                    }
                }
            } catch (error) {
                this.logger.error(`检查活动 "${activity.themeName || '未知活动'}" 自动打卡状态失败:`, error.message);
            }
        }
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

exports.ActivityService = ActivityService;
