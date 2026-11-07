"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCheckService = void 0;

const koishi_1 = require("koishi");
const path_1 = require("path");
const common_1 = require("../util/common");

// TMP 官方文件清单（含每个文件的 MD5），用于比对版本更新前后哪些文件被替换
const FILES_API = "https://update.ets2mp.com/files.json";
// 文字通知里最多列出多少个文件，超出只显示数量，避免消息过长
const MAX_LISTED_FILES = 30;

class VersionCheckService {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.cfg = config;
        this.currentVersion = null;
        // 上一次检查时的文件清单快照（FilePath -> {md5, type}），用于比对文件变化
        this.fileManifest = null;
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
                    stage: response.stage,
                    time: this.convertToUTC8(response.time),
                    supported_game_version: response.supported_game_version,
                    supported_ats_game_version: response.supported_ats_game_version
                };

                this.logger.info(`获取到TMP版本信息: ${versionInfo.name} (${versionInfo.time})`);

                if (this.currentVersion && this.currentVersion.name !== versionInfo.name) {
                    this.logger.info(`检测到版本更新: ${this.currentVersion.name} -> ${versionInfo.name}`);

                    // 比对文件 MD5，找出本次更新实际替换了哪些文件
                    const changedFiles = await this.detectChangedFiles();
                    if (changedFiles.length > 0) {
                        this.logger.info(`本次更新涉及 ${changedFiles.length} 个文件变化`);
                    }

                    await this.sendVersionUpdateNotification(this.currentVersion, versionInfo, changedFiles);
                }

                this.currentVersion = versionInfo;
            } else {
                this.logger.error("TMP版本API返回的数据格式不正确");
            }
        } catch (error) {
            this.logger.error("检查TMP版本失败:", error.message);
        }
    }

    /**
     * 拉取官方文件清单并转成 { FilePath -> Md5 } 映射。
     * 失败时返回 null（调用方据此区分“没变化”和“查不到”）。
     */
    async fetchFileManifest() {
        try {
            const response = await this.ctx.http.get(FILES_API, { timeout: 15000 });
            const files = response && Array.isArray(response.Files) ? response.Files : null;
            if (!files) {
                this.logger.warn("文件清单格式不正确，跳过文件变化比对");
                return null;
            }

            const manifest = new Map();
            for (const file of files) {
                if (file && file.FilePath) {
                    manifest.set(file.FilePath, {
                        md5: String(file.Md5 || "").toLowerCase(),
                        type: file.Type || ""
                    });
                }
            }
            this.logger.debug(`文件清单已加载，共 ${manifest.size} 个文件`);
            return manifest;
        } catch (error) {
            this.logger.warn(`获取文件清单失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 比对「上一次版本的文件清单」与「当前清单」，返回 MD5 变化的文件。
     *
     * 说明：files.json 只提供**当前**版本的文件列表，没有历史版本归档
     * （/0.7.10.0/files.json 等路径均 404）。所以只能在两次检查之间自己留存快照：
     * - 有上一次快照 → 逐文件比对 MD5，新增/删除/改动都算变化；
     * - 没有快照（首次运行或重启）→ 退化为“清单中所有文件都视为本次更新内容”，
     *   并在结果里标注 snapshotMissing，由文案说明这是完整清单而非差异。
     *
     * @returns {Array|null} 变化列表；清单获取失败时返回 null（区别于“没有变化”的空数组）
     */
    async detectChangedFiles() {
        const current = await this.fetchFileManifest();
        if (!current) {
            // 查不到清单 ≠ 没有变化，不能返回 []，否则会误报“未检测到文件变化”
            return null;
        }

        const previous = this.fileManifest;
        this.fileManifest = current;

        if (!previous) {
            this.logger.debug("没有上一次的文件清单快照，本次按完整清单输出");
            return this.buildFullFileList(current, true);
        }

        const changed = [];
        for (const [filePath, info] of current) {
            const old = previous.get(filePath);
            if (!old) {
                changed.push({ path: filePath, type: info.type, kind: 'added' });
            } else if (old.md5 !== info.md5) {
                changed.push({ path: filePath, type: info.type, kind: 'modified' });
            }
        }
        // 上一次有、这次没有 → 被移除
        for (const [filePath, info] of previous) {
            if (!current.has(filePath)) {
                changed.push({ path: filePath, type: info.type, kind: 'removed' });
            }
        }

        // 稳定排序：先 ets2/ats，再 system；同类按路径
        const typeOrder = { ets2: 0, ats: 1, system: 2 };
        changed.sort((a, b) => {
            const ta = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 9;
            const tb = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 9;
            if (ta !== tb) return ta - tb;
            return a.path.localeCompare(b.path);
        });

        return changed;
    }

    /** 没有快照时的退化结果：清单内所有文件 */
    buildFullFileList(manifest, snapshotMissing) {
        const list = [];
        for (const [filePath, info] of manifest) {
            list.push({ path: filePath, type: info.type, kind: 'unknown' });
        }
        const typeOrder = { ets2: 0, ats: 1, system: 2 };
        list.sort((a, b) => {
            const ta = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 9;
            const tb = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 9;
            if (ta !== tb) return ta - tb;
            return a.path.localeCompare(b.path);
        });
        // 用不可枚举标记，避免污染后续 JSON 序列化
        Object.defineProperty(list, 'snapshotMissing', { value: !!snapshotMissing, enumerable: false });
        return list;
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

    async sendVersionUpdateNotification(oldVersion, newVersion, changedFiles) {
        // null = 清单查询失败；数组 = 比对结果（可能为空）
        const fileCount = changedFiles === null ? '查询失败' : `${changedFiles.length}`;
        this.logger.info(`发送版本更新通知到 ${this.cfg.groups.length} 个群组（变化文件: ${fileCount}）`);

        // 内容只构建一次（图片渲染较慢，不要每个群各渲染一遍）
        const message = await this.buildUpdateContent(oldVersion, newVersion, changedFiles);
        const isImage = typeof message === "object" && message !== null;

        for (const groupId of this.cfg.groups) {
            try {
                await this.sendToGroup(groupId, message);
                this.logger.info(`已发送版本更新通知到群组 ${groupId}（${isImage ? "图片" : "文字"}）`);
            } catch (error) {
                this.logger.error(`发送版本更新通知到群组 ${groupId} 失败:`, error.message);
            }
        }
    }

    /**
     * 构建通知内容。notifyType：1=文字（默认），2=图片。
     * 图片渲染失败（如未启用 puppeteer）会**自动回退为文字**，保证通知不丢。
     * @returns 文字字符串，或图片 segment 元素
     */
    async buildUpdateContent(oldVersion, newVersion, changedFiles) {
        const notifyType = Number(this.cfg.notifyType) || 1;
        if (notifyType === 2) {
            const image = await this.renderUpdateImage(oldVersion, newVersion, changedFiles);
            if (image) {
                return image;
            }
        }
        return this.buildUpdateText(oldVersion, newVersion, changedFiles);
    }

    /**
     * 插件配置里的「更新通知附加文本」，原样追加在通知末尾。
     * 支持 \n 转义换行，方便在配置面板里写多行。
     */
    getExtraText() {
        const raw = this.cfg.extraText;
        if (raw == null) return "";
        const text = String(raw).trim();
        if (!text) return "";
        return text.replace(/\\n/g, "\n");
    }

    buildUpdateText(oldVersion, newVersion, changedFiles) {
        let message = `📢 TMP版本更新通知

旧版本: ${oldVersion.name}
新版本: ${newVersion.name}

更新时间: ${newVersion.time}（UTC+8）
欧卡支持版本: ${this.formatGameVersion(oldVersion.supported_game_version, newVersion.supported_game_version)}
美卡支持版本: ${this.formatGameVersion(oldVersion.supported_ats_game_version, newVersion.supported_ats_game_version)}`;

        message += this.formatChangedFiles(changedFiles);

        const extra = this.getExtraText();
        if (extra) {
            message += `\n\n${extra}`;
        }
        return message;
    }

    /**
     * 把变化文件列表拼成消息片段。
     * - files 为 null → 清单获取失败，明确说明“查询失败”，不冒充“无变化”
     * - 空数组 → 确实没有文件变化
     * - 超过 MAX_LISTED_FILES 条 → 只列前若干条 + 「等共 N 个」
     */
    formatChangedFiles(files) {
        if (files === null) {
            return `\n\n更新文件: 文件清单获取失败，无法比对变化`;
        }
        if (!files || files.length === 0) {
            return `\n\n更新文件: 未检测到文件变化`;
        }

        const snapshotMissing = files.snapshotMissing === true;
        const title = snapshotMissing
            ? `更新文件（共 ${files.length} 个，未留存上次清单，以下为完整列表）`
            : `更新文件（共 ${files.length} 个）`;

        const shown = files.slice(0, MAX_LISTED_FILES);
        const lines = shown.map((file) => {
            const mark = file.kind === 'added' ? '[新增] '
                : file.kind === 'removed' ? '[移除] '
                : file.kind === 'modified' ? '[更新] '
                : '';
            return `· ${mark}${file.path}`;
        });

        let text = `\n\n${title}\n${lines.join('\n')}`;
        if (files.length > shown.length) {
            text += `\n… 等共 ${files.length} 个文件`;
        }
        return text;
    }

    /**
     * 游戏支持版本：有变化时显示「旧 → 新」，没变则只显示当前值。
     */
    formatGameVersion(oldValue, newValue) {
        if (oldValue && newValue && String(oldValue) !== String(newValue)) {
            return `${oldValue} → ${newValue}`;
        }
        return newValue || oldValue || "未知";
    }

    /**
     * 用 puppeteer 渲染版本更新卡片
     * @returns 图片 segment 元素；渲染不可用时返回 null，由调用方回退文字
     */
    async renderUpdateImage(oldVersion, newVersion, changedFiles) {
        if (!this.ctx.puppeteer) {
            this.logger.warn("未启用 puppeteer，版本更新通知回退为文字形式");
            return null;
        }
        let page;
        try {
            // null = 清单查询失败，交给模板显示对应提示
            const files = changedFiles === null ? [] : (Array.isArray(changedFiles) ? changedFiles : []);
            const data = {
                oldName: oldVersion.name,
                newName: newVersion.name,
                time: newVersion.time,
                stage: newVersion.stage,
                // 游戏支持版本也带上旧值，卡片才能显示「旧 → 新」对比
                etsOld: oldVersion.supported_game_version,
                etsNew: newVersion.supported_game_version,
                atsOld: oldVersion.supported_ats_game_version,
                atsNew: newVersion.supported_ats_game_version,
                // 变化文件：路径 + 变化类型，卡片里按组展示
                files: files.map((file) => ({
                    path: file.path,
                    kind: file.kind || 'unknown',
                    type: file.type || ''
                })),
                filesSnapshotMissing: changedFiles !== null && changedFiles.snapshotMissing === true,
                filesUnavailable: changedFiles === null,
                extraText: this.getExtraText()
            };
            const htmlPath = path_1.resolve(__dirname, "../resource/version-update.html");
            this.logger.debug(`渲染版本更新卡片: ${htmlPath}`);

            page = await this.ctx.puppeteer.page();
            await page.setViewport({ width: 560, height: 900, deviceScaleFactor: 2 });
            await page.goto(`file:///${htmlPath}`);
            await page.evaluate(`setData(${JSON.stringify(data)})`);
            await common_1.sleep(100);
            await page.waitForNetworkIdle();

            const element = await page.$("#container");
            if (!element) {
                throw new Error("未找到 #container");
            }
            return koishi_1.segment.image(await element.screenshot({ encoding: "binary" }), "image/jpeg");
        } catch (error) {
            this.logger.error(`渲染版本更新卡片失败，回退为文字形式: ${error.message}`);
            return null;
        } finally {
            if (page) {
                try { await page.close(); } catch { }
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
