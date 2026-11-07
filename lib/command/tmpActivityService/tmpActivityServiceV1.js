const evmOpenApi = require('../../api/evmOpenApi');

// serverId 在日志/消息里统一展示：数字型保持数字，其它原样返回
function numericOrRaw(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
}

module.exports = {
    /**
     * 列表接口最多翻几页（每页 100 条）。
     * 平台 2.0 的 /activity/info/list 默认按开始时间倒序，今日活动通常在第 1 页，
     * 但为了不依赖排序（以及以后数据量变大），这里仍然按 totalPage 翻页，只是加个上限防止死循环。
     */
    ACTIVITY_LIST_MAX_PAGE: 10,
    ACTIVITY_LIST_PAGE_SIZE: 100,

    async updateTodayActivities() {
        try {
            this.todayActivities = [];

            const baseUrl = this.cfg.mainSettings?.url || "open.vtcm.link";
            const token = this.cfg.mainSettings?.token || "";
            const pageSize = this.ACTIVITY_LIST_PAGE_SIZE || 100;
            const buildUrl = (page) => `https://${baseUrl}/api/activity/info/list?token=${token}&page=${page}&limit=${pageSize}&themeName=`;

            this.logger.api(`请求V1车队平台API: ${buildUrl(1).replace(token, "***")}`);

            const startTime = Date.now();
            const firstResponse = await this.ctx.http.get(buildUrl(1), { timeout: 10000 });
            const duration = Date.now() - startTime;
            this.logger.api(`V1车队平台API响应耗时: ${duration}ms, 状态码: ${firstResponse.code}`);

            if (this.cfg.debug?.logApiResponses) {
                this.logger.api("V1车队平台API响应详情:", {
                    code: firstResponse.code,
                    totalCount: firstResponse.data?.totalCount,
                    totalPage: firstResponse.data?.totalPage,
                    listCount: firstResponse.data?.list?.length
                });
            }

            if (firstResponse.code !== 0 || !Array.isArray(firstResponse.data?.list)) {
                this.logger.error(`[V1活动更新] 车队平台API返回错误: ${firstResponse.msg || '未知错误'} (代码: ${firstResponse.code || '无'})`);
                this.todayActivities = [];
                return;
            }

            let list = firstResponse.data.list.slice();
            const maxPage = Math.min(Number(firstResponse.data.totalPage) || 1, this.ACTIVITY_LIST_MAX_PAGE || 10);

            for (let page = 2; page <= maxPage; page++) {
                try {
                    const response = await this.ctx.http.get(buildUrl(page), { timeout: 10000 });
                    if (response.code === 0 && Array.isArray(response.data?.list)) {
                        list = list.concat(response.data.list);
                    } else {
                        this.logger.warn(`[V1活动更新] 第 ${page} 页返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                    }
                } catch (error) {
                    // 翻页失败不影响第 1 页结果，今日活动通常就在第 1 页
                    this.logger.warn(`[V1活动更新] 第 ${page} 页请求失败: ${error.message}`);
                }
            }

            const now = new Date();
            const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            this.logger.debug(`[V1活动更新] 当前本地日期: ${today}, UTC日期: ${new Date().toISOString().split("T")[0]}`);

            const originalCount = list.length;
            this.logger.debug(`[V1活动更新] API返回活动总数: ${originalCount}（共 ${maxPage} 页）`);

            this.todayActivities = list.filter((activity) => {
                const activityDate = activity.startTime?.split(" ")[0];
                return activityDate === today;
            });

            this.logger.info(`[V1活动更新] 从车队平台找到 ${this.todayActivities.length}/${originalCount} 个今日活动`);

            if (this.cfg.debug?.debugMode) {
                for (const activity of this.todayActivities) {
                    const profile = this.resolveProfileState(activity);
                    this.logger.debug(`[V1活动更新] 今日活动 #${activity.id} "${activity.themeName}" 档位状态: ${profile.uploaded ? "已上传" : "未上传"}（来源: ${profile.source}, hasProfile=${activity.hasProfile}, profileFile=${activity.profileFile ? "有" : "空"}, state=${activity.state}）`);
                }
            }
        } catch (error) {
            this.logger.error("[V1活动更新] 获取车队平台活动列表失败:", error.message);
            this.todayActivities = [];
        }
    },

    /**
     * 判断活动档（profile）是否已上传。
     *
     * 平台 2.0 起，列表接口 /api/activity/info/list **不再返回 profileFile**（恒为 null），
     * 改用布尔字段 hasProfile 表示档位是否已上传；只有详情接口 /api/activity/info/info/{id}
     * 才带 profileFile。旧版本（1.0）的列表则只有 profileFile。
     * 所以这里必须优先看 hasProfile，否则会永远判定为“未上传”。
     *
     * @returns {{uploaded: boolean, source: 'hasProfile'|'profileFile'|'unknown'}}
     */
    resolveProfileState(activity) {
        if (!activity) return { uploaded: false, source: 'unknown' };

        // 2.0：以 hasProfile 为准（注意 false 也是有效值，不能用 || 兜底）
        if (typeof activity.hasProfile === 'boolean') {
            return { uploaded: activity.hasProfile, source: 'hasProfile' };
        }
        if (activity.hasProfile === 1 || activity.hasProfile === 0) {
            return { uploaded: activity.hasProfile === 1, source: 'hasProfile' };
        }
        if (activity.hasProfile === '1' || activity.hasProfile === '0') {
            return { uploaded: activity.hasProfile === '1', source: 'hasProfile' };
        }

        // 1.0：没有 hasProfile，退回 profileFile 判空
        if ('profileFile' in activity) {
            return { uploaded: !!activity.profileFile, source: 'profileFile' };
        }

        return { uploaded: false, source: 'unknown' };
    },

    /**
     * 查 TMP 服务器名（serverId → serverName）。
     *
     * 数据源 https://evmapi.cxnnn.cn/server/list?game=1（欧卡）。注意该接口返回的是
     * **常驻服**（Simulation 1/2、Arcade、ProMods…），活动专属服（如 serverId=13 的
     * "Revival Event | #26"）并不在里面，此时返回 null 由调用方兜底。
     *
     * 一次检查只拉一次列表，结果缓存在实例上（同一次 checkAutoClockStatus 内的多个活动共用）。
     */
    async getEvmServerNameMap() {
        const now = Date.now();
        // 5 分钟缓存：同一次检查里多个活动共用，也不至于跨天用过期数据
        if (this._evmServerCache && now - this._evmServerCache.at < 5 * 60 * 1000) {
            return this._evmServerCache.map;
        }

        const map = new Map();
        let ok = false;
        try {
            const result = await evmOpenApi.serverList(this.ctx.http, 'ETS2');
            if (result && !result.error && Array.isArray(result.data)) {
                for (const server of result.data) {
                    if (server && server.serverId != null) {
                        map.set(Number(server.serverId), server.serverName);
                    }
                }
                ok = map.size > 0;
                if (ok) {
                    this.logger.debug(`[自动打卡检查] evm 服务器列表已加载，共 ${map.size} 个常驻服`);
                } else {
                    this.logger.warn('[自动打卡检查] evm 服务器列表为空，无法确认服务器名称');
                }
            } else {
                this.logger.warn('[自动打卡检查] evm 服务器列表查询失败，无法确认服务器名称');
            }
        } catch (error) {
            this.logger.warn(`[自动打卡检查] evm 服务器列表查询异常: ${error.message}`);
        }

        // 只在成功时缓存：查询失败不缓存，避免 5 分钟内一直拿空结果
        if (ok) {
            this._evmServerCache = { at: now, map };
        }
        return map;
    },

    async checkAutoClock(activity) {
        try {
            const baseUrl = this.cfg.mainSettings?.url || "open.vtcm.link";
            const token = this.cfg.mainSettings?.token || "";
            const fullUrl = `https://${baseUrl}/api/activity/info/info/${activity.id}?token=${token}`;
            this.logger.api(`请求V1活动详情API: ${fullUrl.replace(token, "***")}`);

            const response = await this.ctx.http.get(fullUrl, { timeout: 10000 });
            this.logger.api(`V1活动详情API响应:`, response);

            if (response.code === 0 && response.data) {
                const enableAutoClock = response.data.enableAutoClock;
                const serverId = response.data.serverId;
                this.logger.debug(`活动 "${activity.themeName}" V1自动打卡状态: ${enableAutoClock}, serverId: ${serverId}`);

                // 宽松判断：接口可能给数字 1 或字符串 "1"
                if (Number(enableAutoClock) === 1) {
                    if (serverId != null && serverId !== '') {
                        const resolved = await this.resolveAutoClockServerName(serverId);
                        let message = '今日活动自动打卡已设置';
                        if (resolved.reason === 'found') {
                            message = `今日活动自动打卡已设置，打卡服务器名称：${resolved.name}`;
                        } else if (resolved.reason === 'not_found') {
                            // 查不到就如实说，不拿平台的活动名顶替（可能与实际开服不一致）
                            message = `今日活动自动打卡已设置，但未查到服务器名称（serverId: ${serverId}，可能尚未开服）`;
                        } else {
                            message = `今日活动自动打卡已设置，但服务器列表查询失败，无法确认服务器名称（serverId: ${serverId}）`;
                        }
                        return {
                            status: 'set',
                            message,
                            serverId: numericOrRaw(serverId),
                            serverName: resolved.reason === 'found' ? resolved.name : null,
                            serverNameReason: resolved.reason
                        };
                    } else {
                        return { status: 'no_server', message: '今日活动打卡服务器未设置' };
                    }
                } else {
                    return { status: 'not_set', message: '今日活动打卡未设置' };
                }
            } else {
                this.logger.error(`V1活动详情API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                return { status: 'error', message: '今日活动打卡状态查询失败（接口返回错误）' };
            }
        } catch (error) {
            this.logger.error(`检查V1活动 "${activity.themeName}" 自动打卡状态失败:`, error.message);
            return { status: 'error', message: '今日活动打卡状态查询失败（请求异常）' };
        }
    },

    /**
     * 按 serverId 在 evm 服务器列表里查服务器名。
     *
     * 只认 evm 的权威数据：查不到就如实返回 reason，**绝不回退用平台活动自带的 serverName**
     * ——平台那个字段是活动创建时填的，与实际开服选择可能不一致，拿来顶替会误导管理。
     *
     * @returns {{name: string|null, reason: 'found'|'not_found'|'unavailable'}}
     */
    async resolveAutoClockServerName(serverId) {
        const numericId = Number(serverId);

        let map;
        try {
            map = await this.getEvmServerNameMap();
        } catch (error) {
            this.logger.warn(`[自动打卡检查] 查询服务器名失败: ${error.message}`);
            return { name: null, reason: 'unavailable' };
        }

        // 列表为空说明接口异常（正常至少有 7 个常驻服），按“查不到”处理
        if (!map || map.size === 0) {
            return { name: null, reason: 'unavailable' };
        }

        if (Number.isFinite(numericId) && map.has(numericId)) {
            return { name: map.get(numericId), reason: 'found' };
        }

        this.logger.debug(`[自动打卡检查] serverId=${serverId} 不在 evm 服务器列表（可能尚未开服）`);
        return { name: null, reason: 'not_found' };
    }
};
