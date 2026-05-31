module.exports = {
    async updateTodayActivities() {
        try {
            this.todayActivities = [];

            const baseUrl = this.cfg.mainSettings?.url || "open.vtcm.link";
            const token = this.cfg.mainSettings?.token || "";
            const fullUrl = `https://${baseUrl}/events`;
            this.logger.api(`请求V2车队平台API: ${fullUrl}`);

            const startTime = Date.now();
            const response = await this.ctx.http.get(fullUrl, {
                timeout: 10000,
                headers: { token }
            });
            const duration = Date.now() - startTime;
            this.logger.api(`V2车队平台API响应耗时: ${duration}ms, 状态码: ${response.code}`);

            if (this.cfg.debug?.logApiResponses) {
                this.logger.api("V2车队平台API响应详情:", {
                    code: response.code,
                    totalCount: response.total,
                    listCount: response.rows?.length
                });
            }

            if (response.code === 200 && response.rows) {
                const now = new Date();
                const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                this.logger.debug(`[V2活动更新] 当前本地日期: ${today}, UTC日期: ${new Date().toISOString().split("T")[0]}`);

                const originalCount = response.rows.length;
                this.logger.debug(`[V2活动更新] API返回活动总数: ${originalCount}`);

                this.todayActivities = response.rows.filter((activity) => {
                    return activity.eventDate === today;
                }).map((activity) => ({
                    ...activity,
                    themeName: activity.eventName,
                    startTime: activity.eventDate,
                    profileFile: activity.saveFileId
                }));

                this.logger.info(`[V2活动更新] 从车队平台找到 ${this.todayActivities.length}/${originalCount} 个今日活动`);
                if (this.cfg.debug?.debugMode && this.todayActivities.length > 0) {
                    const todayActivityNames = this.todayActivities.map(a => `${a.themeName}: ${a.startTime}`);
                    this.logger.debug(`[V2活动更新] 今日活动详情:`, todayActivityNames);
                }
            } else {
                this.logger.error(`[V2活动更新] 车队平台API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                this.todayActivities = [];
            }
        } catch (error) {
            this.logger.error("[V2活动更新] 获取车队平台活动列表失败:", error.message);
            this.todayActivities = [];
        }
    },

    async checkAutoClock(activity) {
        try {
            const baseUrl = this.cfg.mainSettings?.url || "open.vtcm.link";
            const token = this.cfg.mainSettings?.token || "";
            const fullUrl = `https://${baseUrl}/events/${activity.id}`;
            this.logger.api(`请求V2活动详情API: ${fullUrl}`);

            const response = await this.ctx.http.get(fullUrl, {
                timeout: 10000,
                headers: { token }
            });
            this.logger.api(`V2活动详情API响应:`, response);

            if (response.code === 200 && response.data) {
                const autoCheckInEnable = response.data.autoCheckInEnable;
                this.logger.debug(`活动 "${activity.themeName}" V2自动打卡状态: ${autoCheckInEnable}`);
                return autoCheckInEnable === 1;
            } else {
                this.logger.error(`V2活动详情API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                return false;
            }
        } catch (error) {
            this.logger.error(`检查V2活动 "${activity.themeName}" 自动打卡状态失败:`, error.message);
            return false;
        }
    }
};
