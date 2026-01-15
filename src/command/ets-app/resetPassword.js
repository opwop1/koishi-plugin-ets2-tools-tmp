const { h } = require("koishi");

module.exports = async (ctx, cfg, session, targetTeamId, password) => {
    const { url, token, logOutput, platformVersion, mailEnabled, mailTo, mailSubject, mailTemplate, mailFromName } = cfg.mainSettings?.settings || {};
    const { adminUsers } = cfg.resetPassword?.settings || {};
    const currentUserQQ = session.userId;
    const isAdmin = adminUsers.includes(currentUserQQ);
    const isPrivateChat = session.channelId === `private:${currentUserQQ}`;
    const platform = (platformVersion || "v1").toLowerCase();

    // 日志工具函数
    const log = (msg) => logOutput && ctx.logger.info(msg);

    const normalizeBaseUrl = (baseUrl, fallback) => {
        if (!baseUrl) return fallback;
        if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) return baseUrl;
        return `https://${baseUrl}`;
    };

    const parseAtQQ = (raw) => {
        if (!raw?.startsWith("<at ")) return raw;
        const idStart = raw.indexOf('id="');
        if (idStart === -1) return "";
        const idEnd = raw.indexOf('"', idStart + 4);
        if (idEnd === -1) return "";
        return raw.substring(idStart + 4, idEnd);
    };

    const normalizeEmail = (value) => {
        if (!value) return "";
        const trimmed = value.trim();
        const bracketMatch = trimmed.match(/<([^>]+)>/);
        const raw = bracketMatch ? bracketMatch[1] : trimmed;
        return raw.replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
    };

    const sendMail = async (targetMail, subject, content) => {
        const mailBot = ctx.bots.find((bot) => bot.platform === "mail");
        if (!mailBot) {
            log("[V2] 未发现可用的 mail 适配器，无法发送邮件");
            return false;
        }
        const normalizedTarget = targetMail && targetMail.includes(":")
            ? targetMail
            : `private:${targetMail}`;
        const fromAddress = mailBot.user?.id || mailBot.selfId || "mail";
        log(`[V2] 邮件发送状态: 由 ${fromAddress} 发送到 ${targetMail} (channelId=${normalizedTarget}, subject=${subject || ""})`);
        log(`[V2] 邮件发送详情: mailFromName=${mailFromName || ""}, rawContentLength=${(content || "").length}`);
        try {
            const rawMessage = content || "";
            const message = h("message", { subject, fromName: mailFromName || undefined }, rawMessage);
            log(`[V2] 邮件发送详情: rawMessage=${rawMessage}`);
            log(`[V2] 邮件发送详情: messageElement=${JSON.stringify(message)}`);
            await mailBot.sendMessage(normalizedTarget, message);
            log(`[V2] 邮件发送成功: 由 ${fromAddress} 发送到 ${targetMail} (channelId=${normalizedTarget})`);
            return true;
        } catch (error) {
            log(`[V2] 邮件发送失败: 由 ${fromAddress} 发送到 ${targetMail} (channelId=${normalizedTarget}), 错误: ${error.message}`);
            return false;
        }
    };

    const randomChar = (chars) => chars[Math.floor(Math.random() * chars.length)];
    const generatePassword = () => {
        const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const digits = "0123456789";
        const all = letters + digits;
        const chars = [randomChar(letters), randomChar(digits)];
        for (let i = 0; i < 8; i++) {
            chars.push(randomChar(all));
        }
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join("");
    };
    
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
        if (platform === "v2") {
            if (!token) return "未配置车队平台V2.0 API认证令牌";
            const baseUrl = normalizeBaseUrl(url, "https://open.vtcm.link");

            if (!isAdmin && !isPrivateChat) {
                return "您没有权限重置其他用户的密码，请联系管理员重置，或私聊机器人重置";
            }

            let targetQQ = "";
            let memberUid = "";
            let userEmail = "";
            const rawTarget = targetTeamId ? targetTeamId.trim() : "";
            const uidMatch = rawTarget.match(/^uid\s*=\s*(\d+)$/i);

            if (uidMatch) {
                if (!isAdmin) return "仅管理员可使用 uid 参数重置他人密码";
                memberUid = uidMatch[1];
                log(`[V2] 使用 UID 方式重置密码，uid=${memberUid}`);
                const memberUrl = `${baseUrl}/members/get?uid=${encodeURIComponent(memberUid)}`;
                log(`获取成员信息: ${memberUrl}`);
                const memberResponse = await ctx.http.get(memberUrl, { headers: { token } });
                log(`成员信息响应: ${JSON.stringify(memberResponse)}`);
                if (memberResponse.code !== 200 || !memberResponse.data?.uid) {
                    return memberResponse.msg || "未找到用户信息";
                }
                targetQQ = memberResponse.data.qq || targetQQ;
                const rawEmail = memberResponse.data.email || "";
                log(`[V2] 成员邮箱原始值: ${rawEmail}`);
                userEmail = normalizeEmail(rawEmail);
                log(`[V2] 成员邮箱规范化后: ${userEmail}`);
            } else {
                targetQQ = rawTarget ? parseAtQQ(rawTarget) : currentUserQQ;
                log(`[V2] 使用 QQ 方式重置密码，rawTarget=${rawTarget}, parsedQQ=${targetQQ}`);
                if (!targetQQ) return "获取QQ号错误，请使用QQ号重置";
                if (!/^\d+$/.test(targetQQ)) return "QQ号格式不正确，请输入纯数字QQ号";
                if (!isAdmin && targetQQ !== currentUserQQ) {
                    return "您没有权限重置其他成员的密码，请联系管理员";
                }

                const memberUrl = `${baseUrl}/members/get?qq=${encodeURIComponent(targetQQ)}`;
                log(`获取成员信息: ${memberUrl}`);
                const memberResponse = await ctx.http.get(memberUrl, { headers: { token } });
                log(`成员信息响应: ${JSON.stringify(memberResponse)}`);

                if (memberResponse.code !== 200 || !memberResponse.data?.uid) {
                    return memberResponse.msg || "未找到用户信息";
                }
                memberUid = memberResponse.data.uid;
                targetQQ = memberResponse.data.qq || targetQQ;
                const rawEmail = memberResponse.data.email || "";
                log(`[V2] 成员邮箱原始值: ${rawEmail}`);
                userEmail = normalizeEmail(rawEmail);
                log(`[V2] 成员邮箱规范化后: ${userEmail}`);
            }
            if (userEmail) {
                log(`[V2] 成员邮箱: ${userEmail}`);
            } else {
                log("[V2] 成员邮箱为空，可能无法发送到用户邮箱");
            }

            const newPassword = password?.trim() || generatePassword();
            log(`[V2] 即将重置密码，uid=${memberUid}, newPassword=${newPassword}`);
            const resetUrl = `${baseUrl}/members/${memberUid}/password`;
            log(`重置密码请求: ${resetUrl}`);
            const resetResponse = await ctx.http.post(resetUrl, { password: newPassword }, { headers: { token } });
            log(`重置密码响应: ${JSON.stringify(resetResponse)}`);

            if (resetResponse.code !== 200) {
                return resetResponse.msg || "未知错误";
            }

            const effectiveMailTo = normalizeEmail(userEmail || mailTo);
            if (mailEnabled && effectiveMailTo) {
                const template = mailTemplate || "车队平台重置密码成功，uid={uid}，qq={qq}，新密码：{password}";
                const body = template
                    .replace(/{uid}/g, memberUid || "")
                    .replace(/{qq}/g, targetQQ || "")
                    .replace(/{password}/g, newPassword)
                    .replace(/{psw}/g, newPassword);
                const subject = mailSubject || "重置密码通知";
                await sendMail(effectiveMailTo, subject, body);
            } else if (mailEnabled) {
                log("[V2] 已开启邮件发送，但未找到用户邮箱或 mailTo");
            }

            const isAdminOp = isAdmin && (targetQQ || memberUid);
            return isAdminOp
                ? `管理员操作：车队编号 ${memberUid} 的密码重置成功！新密码已发送到用户邮箱。`
                : "密码重置成功！新密码已发送到您的邮箱，请查收。";
        }

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
