module.exports = async (ctx, cfg, session, targetTeamId) => {
    const { url, token, logOutput } = cfg.mainSettings;
    const { adminUsers } = cfg.resetPassword;
    const currentUserQQ = session.userId;
    const isAdmin = adminUsers.includes(currentUserQQ);
    const isPrivateChat = session.channelId === `private:${currentUserQQ}`;

    // 日志工具函数
    const log = (msg) => logOutput && ctx.logger.info(msg);
    
    // 通用HTTP请求函数
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

    // 获取用户信息
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

    // 重置密码
    const resetPassword = async (teamId) => {
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

        // 处理@提及的QQ号
        if (targetTeamId?.startsWith("<at ")) {
            if (!isAdmin) return "您没有权限重置其他用户的密码，请联系管理员";
            
            // 提取QQ号
            const idStart = targetTeamId.indexOf('id="');
            if (idStart === -1) return "获取QQ号错误，请使用车队编号重置";
            
            targetQQ = targetTeamId.substring(idStart + 4, targetTeamId.indexOf('"', idStart + 4));
            if (!/^\d+$/.test(targetQQ)) return "获取QQ号错误，请使用车队编号重置";
            
            log(`管理员 ${currentUserQQ} 重置QQ: ${targetQQ} 密码`);
            const userInfo = await getUserInfo({ qq: targetQQ });
            teamId = userInfo.teamId;
        } 
        // 处理车队编号或私聊场景
        else {
            if (isPrivateChat) {
                // 私聊场景
                if (!targetTeamId) {
                    // 无目标编号时用当前用户QQ查询
                    log(`用户 ${currentUserQQ} 发起密码重置`);
                    const userInfo = await getUserInfo({ qq: currentUserQQ });
                    teamId = userInfo.teamId;
                    if (!teamId) return "未找到您的信息，请联系管理员";
                } else {
                    // 有目标编号时验证权限
                    const userInfo = await getUserInfo({ teamId: targetTeamId });
                    if (!isAdmin && userInfo.qq !== currentUserQQ) {
                        return "您没有权限重置其他成员的密码，请联系管理员";
                    }
                    teamId = targetTeamId;
                }
            } else {
                // 非私聊场景（仅管理员可操作）
                if (!isAdmin) return "您没有权限重置其他用户的密码，请联系管理员重置，或私聊机器人重置";
                
                teamId = targetTeamId;
                log(`管理员 ${currentUserQQ} 重置车队: ${teamId} 密码`);
                await getUserInfo({ teamId }); // 验证车队存在性
            }
        }

        // 执行密码重置
        const resetTeamId = await resetPassword(teamId);
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