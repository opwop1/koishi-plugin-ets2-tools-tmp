"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCheckService = void 0;

const koishi_1 = require("koishi");

class VersionCheckService {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.cfg = config;
        this.currentVersion = null;
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
                if (this.cfg.debug?.logApiResponses) {
                    this.ctx.logger.info(`[TMP-BOT API] ${message}`, data ? JSON.stringify(data, null, 2) : "");
                }
            }
        };
    }

    start() {
        this.setupVersionCheck();
        this.ctx.on("dispose", () => this.cleanup());
    }

    setupVersionCheck() {
        this.logger.info("设置TMP版本检查服务");
        
        this.logger.debug("启动时立即检查版本");
        this.checkVersion();

        const checkInterval = this.cfg.checkInterval * 60 * 1000;
        this.logger.info(`设置定时版本检查，间隔: ${this.cfg.checkInterval} 分钟`);
        
        const intervalTimer = setInterval(async () => {
            this.logger.debug("执行定时版本检查");
            await this.checkVersion();
        }, checkInterval);
        this.timers.push(intervalTimer);
    }

    async checkVersion() {
        try {
            const apiUrl = "https://api.truckersmp.com/v2/version";
            this.logger.api(`请求TMP版本API: ${apiUrl}`);

            const startTime = Date.now();
            const response = await this.ctx.http.get(apiUrl, { timeout: 10000 });
            const duration = Date.now() - startTime;
            this.logger.api(`TMP版本API响应耗时: ${duration}ms`);

            if (response && response.name) {
                const versionInfo = {
                    name: response.name,
                    time: this.convertToUTC8(response.time),
                    supported_game_version: response.supported_game_version,
                    supported_ats_game_version: response.supported_ats_game_version
                };

                this.logger.info(`获取到TMP版本信息: ${versionInfo.name} (${versionInfo.time})`);

                if (this.currentVersion && this.currentVersion.name !== versionInfo.name) {
                    this.logger.info(`检测到版本更新: ${this.currentVersion.name} -> ${versionInfo.name}`);
                    await this.sendVersionUpdateNotification(this.currentVersion, versionInfo);
                }

                this.currentVersion = versionInfo;
            } else {
                this.logger.error("TMP版本API返回的数据格式不正确");
            }
        } catch (error) {
            this.logger.error("检查TMP版本失败:", error.message);
        }
    }

    convertToUTC8(utcTimeString) {
        try {
            const utcDate = new Date(utcTimeString);
            const utc8Date = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
            const year = utc8Date.getFullYear();
            const month = String(utc8Date.getMonth() + 1).padStart(2, '0');
            const day = String(utc8Date.getDate()).padStart(2, '0');
            const hours = String(utc8Date.getHours()).padStart(2, '0');
            const minutes = String(utc8Date.getMinutes()).padStart(2, '0');
            const seconds = String(utc8Date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            this.logger.error("转换UTC时间失败:", error.message);
            return utcTimeString;
        }
    }

    async sendVersionUpdateNotification(oldVersion, newVersion) {
        const message = `📢 TMP版本更新通知

旧版本: ${oldVersion.name}
新版本: ${newVersion.name}

更新时间: ${newVersion.time}（UTC+8）
欧卡支持版本: ${newVersion.supported_game_version}
美卡支持版本: ${newVersion.supported_ats_game_version}`;

        this.logger.info(`发送版本更新通知到 ${this.cfg.groups.length} 个群组`);

        for (const groupId of this.cfg.groups) {
            try {
                await this.sendToGroup(groupId, message);
                this.logger.info(`已发送版本更新通知到群组 ${groupId}`);
            } catch (error) {
                this.logger.error(`发送版本更新通知到群组 ${groupId} 失败:`, error.message);
            }
        }
    }

    async sendToGroup(groupId, message) {
        const onebotBots = this.ctx.bots.filter((bot) => {
            return bot.platform === "onebot";
        });

        if (onebotBots.length === 0) {
            throw new Error("请启用onebot适配器以发送群消息");
        }

        let lastError = null;
        this.logger.debug(`尝试通过 ${onebotBots.length} 个onebot适配器发送消息到群组 ${groupId}`);

        for (const bot of onebotBots) {
            try {
                await bot.sendMessage(groupId, message);
                this.logger.debug(`已通过 ${bot.platform} 适配器发送消息到群组 ${groupId}`);
                return;
            } catch (error) {
                lastError = error;
                this.logger.warn(`通过 ${bot.platform} 适配器发送消息失败: ${error.message}`);
            }
        }

        throw lastError || new Error(`所有onebot适配器都无法发送消息到群组 ${groupId}`);
    }

    cleanup() {
        this.logger.debug("插件卸载，开始清理版本检查服务资源");
        this.timers.forEach((timer) => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        this.timers.length = 0;
    }
}

exports.VersionCheckService = VersionCheckService;
