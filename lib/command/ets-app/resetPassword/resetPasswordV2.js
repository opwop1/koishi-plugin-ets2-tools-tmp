module.exports = async (ctx, cfg, session, password) => {
    const { url, token, logOutput } = cfg.mainSettings?.settings || {};
    const currentUserQQ = session.userId;
    const isPrivateChat = session.channelId === `private:${currentUserQQ}`;

    const log = (msg) => logOutput && ctx.logger.info(msg);

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

    try {
        if (!isPrivateChat) {
            return "V2.0平台密码重置仅支持私聊使用，请私聊机器人进行操作";
        }

        if (!token) return "未配置车队平台V2.0 API认证令牌";

        const baseUrl = url || "open.vtcm.link";
        const queryQQ = currentUserQQ;

        const memberUrl = `https://${baseUrl}/members/get?qq=${encodeURIComponent(queryQQ)}`;
        log(`[V2] 获取成员信息: ${memberUrl}`);
        const memberResponse = await ctx.http.get(memberUrl, { headers: { token } });
        log(`[V2] 成员信息响应: ${JSON.stringify(memberResponse)}`);

        if (memberResponse.code !== 200 || !memberResponse.data?.uid) {
            return memberResponse.msg || "未找到与您QQ号关联的用户信息";
        }

        const memberUid = memberResponse.data.uid;
        const newPassword = password?.trim() || generatePassword();

        if (newPassword.length < 6 || newPassword.length > 16) {
            return "密码长度需为6-16位";
        }

        const resetUrl = `https://${baseUrl}/members/${memberUid}/password`;
        log(`[V2] 重置密码请求: ${resetUrl}`);
        const resetResponse = await ctx.http.post(resetUrl, { password: newPassword }, { headers: { token } });
        log(`[V2] 重置密码响应: ${JSON.stringify(resetResponse)}`);

        if (resetResponse.code !== 200) {
            return resetResponse.msg || "密码重置失败";
        }

        return `密码重置成功！\n您的UID: ${memberUid}\n新密码: ${newPassword}\n请妥善保管好您的密码，以防泄露`;

    } catch (error) {
        ctx.logger.error(`[V2] 密码重置错误: ${error.message}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        } else if (error.code) {
            return `网络错误: ${error.code}`;
        } else {
            return "系统错误，请稍后重试";
        }
    }
};
