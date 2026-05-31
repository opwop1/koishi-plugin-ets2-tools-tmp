module.exports = async (ctx, cfg, session, target, changeType, quantity) => {
    const { url, token, logOutput } = cfg.mainSettings?.settings || {};
    const { adminUsers } = cfg.changePoint?.settings || {};
    const currentUserQQ = session.userId;
    const isPrivateChat = session.channelId === `private:${currentUserQQ}`;
    const isAdmin = adminUsers.includes(currentUserQQ);

    const log = (msg) => logOutput && ctx.logger.info(msg);

    const parseAtQQ = (raw) => {
        if (!raw?.startsWith("<at ")) return raw;
        const idStart = raw.indexOf('id="');
        if (idStart === -1) return "";
        const idEnd = raw.indexOf('"', idStart + 4);
        if (idEnd === -1) return "";
        return raw.substring(idStart + 4, idEnd);
    };

    try {
        if (isPrivateChat) {
            return "积分修改功能仅支持群聊使用";
        }

        if (!isAdmin) {
            return "您没有权限使用积分修改功能，请联系管理员";
        }

        if (!token) return "未配置车队平台V2.0 API认证令牌";

        if (!changeType || !["增加", "减少"].includes(changeType)) {
            return "请指定操作类型：增加 或 减少";
        }

        if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
            return "请输入有效的积分数量（正整数）";
        }

        const baseUrl = url || "open.vtcm.link";
        let uid;

        if (target) {
            const parsedQQ = parseAtQQ(target);
            if (parsedQQ && /^\d+$/.test(parsedQQ)) {
                const memberUrl = `https://${baseUrl}/members/get?qq=${encodeURIComponent(parsedQQ)}`;
                log(`[V2] 获取成员信息: ${memberUrl}`);
                const memberResponse = await ctx.http.get(memberUrl, { headers: { token } });
                log(`[V2] 成员信息响应: ${JSON.stringify(memberResponse)}`);

                if (memberResponse.code !== 200 || !memberResponse.data?.uid) {
                    return memberResponse.msg || `未找到QQ号 ${parsedQQ} 关联的用户信息`;
                }
                uid = memberResponse.data.uid;
            } else if (/^\d+$/.test(target)) {
                uid = target;
            } else {
                return "目标用户格式不正确，请输入UID或@群成员";
            }
        } else {
            return "请指定目标用户（UID或@群成员）";
        }

        const changeTypeNum = changeType === "增加" ? 1 : 2;
        const quantityNum = Number(quantity);

        const changeUrl = `https://${baseUrl}/members/point/change`;
        const requestBody = {
            uid: Number(uid),
            changeType: changeTypeNum,
            quantity: quantityNum
        };
        log(`[V2] 积分修改请求: ${changeUrl}, body: ${JSON.stringify(requestBody)}`);
        const changeResponse = await ctx.http.post(changeUrl, requestBody, { headers: { token } });
        log(`[V2] 积分修改响应: ${JSON.stringify(changeResponse)}`);

        if (changeResponse.code !== 200) {
            return changeResponse.msg || "积分修改失败";
        }

        return `积分修改成功！\n目标UID: ${uid}\n操作: ${changeType} ${quantityNum} 积分`;

    } catch (error) {
        ctx.logger.error(`[V2] 积分修改错误: ${error.message}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        } else if (error.code) {
            return `网络错误: ${error.code}`;
        } else {
            return "系统错误，请稍后重试";
        }
    }
};
