const { segment } = require('koishi');
const { resolve } = require('path');
const common = require('../../../util/common');

module.exports = async (ctx, cfg, session) => {
    // 群组限制检查
    const mainGroups = cfg.tmpActivityService?.mainGroup?.groups || [];
    const adminGroups = cfg.tmpActivityService?.admin?.groups || [];
    const allowedGroups = [...new Set([...mainGroups, ...adminGroups])];

    if (allowedGroups.length === 0) {
        return '未配置允许使用此指令的群组';
    }

    // 当前会话的群号（onebot 平台格式为 group:xxx）
    const currentGroupId = session.channelId;
    const isAllowed = allowedGroups.some(g => currentGroupId.includes(g));

    if (!isAllowed) {
        return '该指令在本群聊不可用';
    }

    if (!ctx.puppeteer) {
        return '未启用 Puppeteer 功能';
    }

    const settings = cfg.mainSettings?.settings || {};
    const baseUrl = settings.url || "open.vtcm.link";
    const token = settings.token || "";
    const logOutput = settings.logOutput;

    const log = (msg) => logOutput && ctx.logger.info(msg);

    try {
        log('[积分排行] 开始查询车队成员积分信息');

        // 分页获取全部成员数据（API page 参数为 1-indexed）
        const allMembers = [];
        let currentPage = 1;
        let totalPage = 1;

        while (currentPage <= totalPage) {
            const queryUrl = `https://${baseUrl}/api/user/info/list?page=${currentPage}&limit=100&tmpId=&tmpName=&teamId=&qq=&state=0&teamRole=&token=${token}`;
            log(`[积分排行] 请求第 ${currentPage} 页: ${queryUrl.replace(token, "***")}`);

            const response = await ctx.http.get(queryUrl, { timeout: 10000 });

            if (response.code !== 0) {
                log(`[积分排行] 第 ${currentPage} 页请求失败: ${response.msg || '未知错误'}`);
                return response.msg || '查询成员信息失败';
            }

            if (!response.page?.list) {
                log(`[积分排行] 第 ${currentPage} 页数据为空`);
                break;
            }

            allMembers.push(...response.page.list);
            totalPage = response.page.totalPage || 1;
            currentPage++;

            log(`[积分排行] 已获取 ${allMembers.length}/${response.page.totalCount} 条记录, 总页数: ${totalPage}`);
        }

        if (allMembers.length === 0) {
            return '暂无成员数据';
        }

        // 按 id 去重（防止分页返回重复数据）
        const uniqueMembers = [];
        const seenIds = new Set();
        for (const m of allMembers) {
            if (m.id && !seenIds.has(m.id)) {
                seenIds.add(m.id);
                uniqueMembers.push(m);
            }
        }
        log(`[积分排行] 去重前: ${allMembers.length}, 去重后: ${uniqueMembers.length}`);

        // 按 rewardPoints 降序排序
        const sortedMembers = uniqueMembers
            .filter(m => typeof m.rewardPoints === 'number')
            .sort((a, b) => b.rewardPoints - a.rewardPoints);

        // 取前10
        const top10 = sortedMembers
            .slice(0, 10)
            .map((player, index) => ({
                rank: index + 1,
                tmpName: player.tmpName || '未知',
                tmpId: player.tmpId,
                teamId: player.teamId,
                rewardPoints: player.rewardPoints || 0,
                teamRole: player.teamRole || '',
                avatarUrl: player.avatarUrl || ''
            }));

        log(`[积分排行] 排行榜前10名已生成, 第一名: ${top10[0]?.tmpName} (${top10[0]?.rewardPoints}积分)`);

        // 查询当前用户的排名
        let currentPlayer = null;
        const currentUserQQ = String(session.userId || '');
        if (currentUserQQ) {
            const playerIndex = sortedMembers.findIndex(m => String(m.qq) === currentUserQQ);
            if (playerIndex !== -1) {
                const player = sortedMembers[playerIndex];
                currentPlayer = {
                    rank: playerIndex + 1,
                    tmpName: player.tmpName || '未知',
                    tmpId: player.tmpId,
                    teamId: player.teamId,
                    rewardPoints: player.rewardPoints || 0,
                    avatarUrl: player.avatarUrl || ''
                };
                log(`[积分排行] 找到当前用户: ${currentPlayer.tmpName}, 排名: ${currentPlayer.rank}, 积分: ${currentPlayer.rewardPoints}`);
            } else {
                log(`[积分排行] 未在车队成员中找到当前用户QQ: ${currentUserQQ}`);
            }
        }

        // 拼接页面数据
        const data = {
            top10: top10,
            totalCount: uniqueMembers.length,
            currentPlayer: currentPlayer,
            updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        };

        // 渲染图片
        let page;
        try {
            page = await ctx.puppeteer.page();
            await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
            await page.goto(`file:///${resolve(__dirname, '../../../resource/point-leaderboard.html')}`);
            await page.evaluate(`setData(${JSON.stringify(data)})`);
            await page.waitForNetworkIdle();
            await common.sleep(800);
            const element = await page.$("#container");
            return segment.image(await element.screenshot({
                encoding: "binary"
            }), "image/jpg");
        }
        catch (e) {
            log(`[积分排行] 渲染异常: ${e.message}`);
            return '渲染异常，请重试';
        }
        finally {
            if (page) {
                await page.close();
            }
        }
    } catch (error) {
        log(`[积分排行] 系统错误: ${error.message}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        }
        return '系统错误，请稍后重试';
    }
};
