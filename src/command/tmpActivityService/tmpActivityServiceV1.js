module.exports = {
    async updateTodayActivities() {
        try {
            this.todayActivities = [];

            const baseUrl = this.cfg.mainSettings?.url || "open.vtcm.link";
            const token = this.cfg.mainSettings?.token || "";
            const fullUrl = `https://${baseUrl}/api/activity/info/list?token=${token}&page=1&limit=100&themeName=`;
            this.logger.api(`请求V1车队平台API: ${fullUrl.replace(token, "***")}`);

            const startTime = Date.now();
            const response = await this.ctx.http.get(fullUrl, { timeout: 10000 });
            const duration = Date.now() - startTime;
            this.logger.api(`V1车队平台API响应耗时: ${duration}ms, 状态码: ${response.code}`);

            if (this.cfg.debug?.logApiResponses) {
                this.logger.api("V1车队平台API响应详情:", {
                    code: response.code,
                    totalCount: response.data?.totalCount,
                    listCount: response.data?.list?.length
                });
            }

            if (response.code === 0 && response.data?.list) {
                const now = new Date();
                const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                this.logger.debug(`[V1活动更新] 当前本地日期: ${today}, UTC日期: ${new Date().toISOString().split("T")[0]}`);

                const originalCount = response.data.list.length;
                this.logger.debug(`[V1活动更新] API返回活动总数: ${originalCount}`);

                this.todayActivities = response.data.list.filter((activity) => {
                    const activityDate = activity.startTime?.split(" ")[0];
                    return activityDate === today;
                });

                this.logger.info(`[V1活动更新] 从车队平台找到 ${this.todayActivities.length}/${originalCount} 个今日活动`);
            } else {
                this.logger.error(`[V1活动更新] 车队平台API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                this.todayActivities = [];
            }
        } catch (error) {
            this.logger.error("[V1活动更新] 获取车队平台活动列表失败:", error.message);
            this.todayActivities = [];
        }
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

                if (enableAutoClock === 1) {
                    if (serverId != null) {
                        return { status: 'set', message: '今日活动自动打卡已设置' };
                    } else {
                        return { status: 'no_server', message: '今日活动打卡服务器未设置' };
                    }
                } else {
                    return { status: 'not_set', message: '今日活动打卡未设置' };
                }
            } else {
                this.logger.error(`V1活动详情API返回错误: ${response.msg || '未知错误'} (代码: ${response.code || '无'})`);
                return { status: 'not_set', message: '今日活动打卡未设置' };
            }
        } catch (error) {
            this.logger.error(`检查V1活动 "${activity.themeName}" 自动打卡状态失败:`, error.message);
            return { status: 'not_set', message: '今日活动打卡未设置' };
        }
    }
};
