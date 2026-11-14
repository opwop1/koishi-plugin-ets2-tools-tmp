const qqOfficial = require('../../../util/qqOfficial');
module.exports = async (ctx, cfg, session, target, changeType, quantity, reason) => {
    const { url, token, logOutput } = cfg.mainSettings?.settings || {};
    const { adminUsers } = cfg.changePoint?.settings || {};
    const currentUserQQ = session.userId;
    const isPrivateChat = session.channelId === `private:${currentUserQQ}`;
    const isAdmin = adminUsers.includes(currentUserQQ);
    // QQ 官方机器人：只能拿到 unionid，没有 QQ 号
    const official = qqOfficial.isQQOfficial(session);
    const officialIdent = official ? qqOfficial.getQQIdentity(session) : null;

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

        if (!token) return "未配置车队平台API认证令牌";

        if (!changeType || !["增加", "减少"].includes(changeType)) {
            return "请指定操作类型：增加 或 减少";
        }

        if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
            return "请输入有效的积分数量（正整数）";
        }

        if (!reason) {
            return "请输入备注原因（必填）";
        }

        const baseUrl = url || "open.vtcm.link";
        let userId;

        if (target) {
            // 只有真正的 <at ...> 才算 QQ 号来源；纯数字既可能是 QQ 也可能是车队编号，
            // 旧代码用 parseAtQQ 的“原样返回”会把车队编号误判成 QQ，这里显式区分。
            const isAtMention = String(target).startsWith("<at ");
            const parsedQQ = isAtMention ? parseAtQQ(target) : null;
            const atId = parsedQQ && /^\d+$/.test(parsedQQ) ? parsedQQ : null;
            const isTeamId = !isAtMention && /^\d+$/.test(target);

            let queryUrl;
            if (official) {
                // 官方机器人：@ 拿到的是 openid 不是 QQ 号，只能按车队编号
                if (isAtMention) {
                    return "QQ 官方机器人暂不支持通过 @ 指定成员，请改用车队编号（如「积分修改 789 增加 10 备注」）";
                }
                if (!officialIdent || !officialIdent.unionId) {
                    return "未获取到 unionid，无法执行积分修改。请确认机器人已开通 unionid 权限";
                }
                if (isTeamId) {
                    queryUrl = `https://${baseUrl}/api/user/info/list?token=${token}&page=1&limit=7&tmpId=&tmpName=&teamId=${encodeURIComponent(target)}&qq=&unionid=&state=0&teamRole=&isExecutive=&isManager=&adminUserId=`;
                    log(`[V1] 通过车队编号查询成员: ${target}`);
                } else {
                    return "目标用户格式不正确，请输入车队编号";
                }
            } else if (isAtMention && atId) {
                queryUrl = `https://${baseUrl}/api/user/info/list?token=${token}&page=1&limit=7&tmpId=&tmpName=&teamId=&qq=${encodeURIComponent(atId)}&unionid=&state=0&teamRole=&isExecutive=&isManager=&adminUserId=`;
                log(`[V1] 通过QQ号查询成员: ${atId}`);
            } else if (isTeamId) {
                queryUrl = `https://${baseUrl}/api/user/info/list?token=${token}&page=1&limit=7&tmpId=&tmpName=&teamId=${encodeURIComponent(target)}&qq=&unionid=&state=0&teamRole=&isExecutive=&isManager=&adminUserId=`;
                log(`[V1] 通过车队编号查询成员: ${target}`);
            } else {
                return "目标用户格式不正确，请输入车队编号或@群成员";
            }

            log(`[V1] 查询成员URL: ${queryUrl.replace(token, "***")}`);
            const queryResponse = await ctx.http.get(queryUrl, { timeout: 10000 });
            log(`[V1] 查询成员响应: code=${queryResponse.code}, listCount=${queryResponse.page?.list?.length}`);

            if (queryResponse.code !== 0) {
                return queryResponse.msg || "成员信息查询失败";
            }

            const list = queryResponse.page?.list;
            if (!list || list.length === 0) {
                return "没有找到该成员";
            }

            userId = list[0].id;
            log(`[V1] 获取到成员ID: ${userId}`);
        } else {
            return "请指定目标用户（车队编号或@群成员）";
        }

        const changeTypeNum = changeType === "增加" ? 1 : 2;
        const quantityNum = Number(quantity);

        const changeUrl = `https://${baseUrl}/api/point/changeRecord/add`;
        const requestBody = {
            userId: userId,
            changeType: changeTypeNum,
            quantity: String(quantityNum),
            reason: reason
        };
        log(`[V1] 积分修改请求: ${changeUrl}, body: ${JSON.stringify(requestBody)}`);
        const changeResponse = await ctx.http.post(changeUrl, requestBody, {
            timeout: 10000,
            headers: { "Content-Type": "application/json", token }
        });
        log(`[V1] 积分修改响应: ${JSON.stringify(changeResponse)}`);

        if (changeResponse.code !== 0) {
            return changeResponse.msg || "积分修改失败";
        }

        return `积分修改成功！\n操作: ${changeType} ${quantityNum} 积分`;

    } catch (error) {
        ctx.logger.error(`[V1] 积分修改错误: ${error.message}`);
        if (error.response) {
            return `请求失败: ${error.response.status} ${error.response.statusText}`;
        } else if (error.code) {
            return `网络错误: ${error.code}`;
        } else {
            return "系统错误，请稍后重试";
        }
    }
};
