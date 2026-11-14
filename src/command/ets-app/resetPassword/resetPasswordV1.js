const qqOfficial = require('../../../util/qqOfficial');
module.exports = async (ctx, cfg, session, targetTeamId, password) => {
    const { url, token, logOutput } = cfg.mainSettings?.settings || {};
    const { adminUsers } = cfg.resetPassword?.settings || {};
    const currentUserQQ = session.userId;
    const isAdmin = adminUsers.includes(currentUserQQ);
    const isPrivateChat = session.channelId === `private:${currentUserQQ}`;

    const log = (msg) => logOutput && ctx.logger.info(msg);

    // QQ 官方机器人：只能拿到 unionid，没有 QQ 号
    const official = qqOfficial.isQQOfficial(session);
    const officialUnionId = official ? (qqOfficial.getQQIdentity(session).unionId || '') : '';

    /** 「查我自己」的查询参数：onebot 用 qq，官方机器人用 unionid */
    const selfQuery = official
        ? (officialUnionId ? { unionid: officialUnionId } : null)
        : { qq: currentUserQQ };

    /**
     * 判断某条平台用户记录是否属于「当前会话用户」。
     * onebot 比 qq，官方机器人比 unionid。
     */
    const isSelf = (userInfo) => {
        if (!userInfo) return false;
        if (official) {
            if (!officialUnionId) return false;
            return String(userInfo.unionid || '') === officialUnionId;
        }
        return String(userInfo.qq) === String(currentUserQQ);
    };

    const parseAtQQ = (raw) => {
        if (!raw?.startsWith("<at ")) return raw;
        const idStart = raw.indexOf('id="');
        if (idStart === -1) return "";
        const idEnd = raw.indexOf('"', idStart + 4);
        if (idEnd === -1) return "";
        return raw.substring(idStart + 4, idEnd);
    };

    const fetchData = async (apiUrl) => {
        try {
            const response = await ctx.http.post(apiUrl);
            log(`请求响应: ${JSON.stringify(response)}`);
            return response;
        } catch (error) {
            log(`请求错误: ${error}`);
            throw error;
        }
    };

    const getUserInfo = async (params) => {
        const query = new URLSearchParams({ token, page: 0, limit: 1, ...params }).toString();
        const userInfoUrl = `https://${url}/api/user/info/list?${query}`;
        log(`获取用户信息: ${userInfoUrl}`);
        const response = await fetchData(userInfoUrl);

        if (response.code !== 0 || !response.page?.list?.length) {
            throw new Error(`未找到用户信息`);
        }
        return response.page.list[0];
    };

    const resetPasswordApi = async (teamId) => {
        const resetUrl = `https://${url}/api/user/info/resetPasswordWithTeamId?token=${token}&teamId=${teamId}`;
        log(`重置密码请求: ${resetUrl}`);
        const response = await fetchData(resetUrl);

        if (response.code !== 0) {
            throw new Error(response.msg || "未知错误");
        }
        return teamId;
    };

    try {
        let teamId, targetQQ;

        if (targetTeamId?.startsWith("<at ")) {
            if (!isAdmin) return "您没有权限重置其他用户的密码，请联系管理员";
            // 官方机器人 @ 拿到的是 openid，不是 QQ 号，无法用于查询
            if (official) {
                return "QQ 官方机器人暂不支持通过 @ 指定成员，请改用车队编号（如「重置密码 789」）";
            }

            const idStart = targetTeamId.indexOf('id="');
            if (idStart === -1) return "获取QQ号错误，请使用车队编号重置";

            targetQQ = targetTeamId.substring(idStart + 4, targetTeamId.indexOf('"', idStart + 4));
            if (!/^\d+$/.test(targetQQ)) return "获取QQ号错误，请使用车队编号重置";

            log(`管理员 ${currentUserQQ} 重置QQ: ${targetQQ} 密码`);
            const userInfo = await getUserInfo({ qq: targetQQ });
            teamId = userInfo.teamId;
        } else {
            if (isPrivateChat) {
                if (!targetTeamId) {
                    log(`用户 ${currentUserQQ} 发起密码重置`);
                    if (!selfQuery) return "未获取到你的 unionid，无法重置密码。请确认机器人已开通 unionid 权限";
                    const userInfo = await getUserInfo(selfQuery);
                    teamId = userInfo.teamId;
                    if (!teamId) return "未找到您的信息，请联系管理员";
                } else {
                    log(`用户 ${currentUserQQ} 尝试重置车队编号 ${targetTeamId} 的密码`);
                    const userInfo = await getUserInfo({ teamId: targetTeamId });

                    // 归属校验：官方机器人没有 QQ 号，改用 unionid 比对
                    if (!isAdmin && !isSelf(userInfo)) {
                        return "您没有权限重置其他成员的密码，请联系管理员";
                    }

                    teamId = targetTeamId;
                    if (isAdmin) {
                        log(`管理员 ${currentUserQQ} 重置车队编号 ${targetTeamId} 的密码`);
                    } else {
                        log(`验证通过，车队编号 ${targetTeamId} 的归属校验通过（${official ? 'unionid' : 'QQ'} 一致）`);
                    }
                }
            } else {
                if (!isAdmin) return "您没有权限重置其他用户的密码，请联系管理员重置，或私聊机器人重置";

                teamId = targetTeamId;
                log(`管理员 ${currentUserQQ} 重置车队: ${teamId} 密码`);
                await getUserInfo({ teamId });
            }
        }

        const resetTeamId = await resetPasswordApi(teamId);
        const isAdminOp = isAdmin && (targetTeamId || targetQQ);
        return isAdminOp
            ? `管理员操作：车队编号 ${resetTeamId} 的密码重置成功！新密码已发送到用户邮箱。`
            : "密码重置成功！新密码已发送到您的邮箱，请查收。";

    } catch (error) {
        ctx.logger.error(`密码重置错误: ${error.message}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        } else if (error.code) {
            return `网络错误: ${error.code}`;
        } else {
            return error.message.includes("未找到") ? error.message : "系统错误，请稍后重试";
        }
    }
};
